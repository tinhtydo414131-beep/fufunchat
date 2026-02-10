import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function getUserClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

function base64UrlEncode(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const padding = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

async function generateVapidKeys() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  return {
    publicKey: base64UrlEncode(new Uint8Array(publicKeyRaw)),
    privateKey: privateKeyJwk.d!,
  };
}

async function getOrCreateVapidKeys(supabaseAdmin: ReturnType<typeof createClient>) {
  const { data } = await supabaseAdmin
    .from("vapid_keys")
    .select("public_key, private_key")
    .eq("id", 1)
    .maybeSingle();
  if (data) return data;

  const keys = await generateVapidKeys();
  await supabaseAdmin.from("vapid_keys").insert({
    id: 1,
    public_key: keys.publicKey,
    private_key: keys.privateKey,
  });
  return { public_key: keys.publicKey, private_key: keys.privateKey };
}

async function createVapidJwt(audience: string, subject: string, privateKeyD: string, publicKeyBase64: string) {
  const publicKeyBytes = base64UrlDecode(publicKeyBase64);
  const x = base64UrlEncode(publicKeyBytes.slice(1, 33));
  const y = base64UrlEncode(publicKeyBytes.slice(33, 65));

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d: privateKeyD },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ aud: audience, exp: now + 86400, sub: subject })));

  const input = `${header}.${payload}`;
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, new TextEncoder().encode(input));
  const sigBytes = new Uint8Array(signature);

  // Convert DER to raw R||S if needed
  let rawSig: Uint8Array;
  if (sigBytes.length === 64) {
    rawSig = sigBytes;
  } else {
    rawSig = new Uint8Array(64);
    let offset = 2;
    const rLen = sigBytes[offset + 1];
    offset += 2;
    const rStart = rLen === 33 ? offset + 1 : offset;
    const rActualLen = rLen === 33 ? 32 : rLen;
    rawSig.set(sigBytes.slice(rStart, rStart + rActualLen), 32 - rActualLen);
    offset += rLen;
    const sLen = sigBytes[offset + 1];
    offset += 2;
    const sStart = sLen === 33 ? offset + 1 : offset;
    const sActualLen = sLen === 33 ? 32 : sLen;
    rawSig.set(sigBytes.slice(sStart, sStart + sActualLen), 64 - sActualLen);
  }

  return `${input}.${base64UrlEncode(rawSig)}`;
}

async function encryptPayload(payloadStr: string, p256dhBase64: string, authBase64: string) {
  const userPubBytes = base64UrlDecode(p256dhBase64);
  const authSecret = base64UrlDecode(authBase64);

  const userPubKey = await crypto.subtle.importKey("raw", userPubBytes, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const localKP = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: userPubKey }, localKP.privateKey, 256));
  const localPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKP.publicKey));

  // HKDF: PRK = HMAC-SHA256(auth_secret, shared_secret)
  const prkKey = await crypto.subtle.importKey("raw", authSecret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, sharedSecret));

  // IKM = HKDF-Expand(PRK, info, 32)
  const info = new Uint8Array([
    ...new TextEncoder().encode("WebPush: info\0"),
    ...userPubBytes,
    ...localPubRaw,
    1,
  ]);
  const ikmKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const ikm = new Uint8Array(await crypto.subtle.sign("HMAC", ikmKey, info)).slice(0, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));

  // PRK2 = HMAC-SHA256(salt, ikm)
  const saltKey = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk2 = new Uint8Array(await crypto.subtle.sign("HMAC", saltKey, ikm));

  const prk2Key = await crypto.subtle.importKey("raw", prk2, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

  const cekInfo = new Uint8Array([...new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 1]);
  const cek = new Uint8Array(await crypto.subtle.sign("HMAC", prk2Key, cekInfo)).slice(0, 16);

  const nonceInfo = new Uint8Array([...new TextEncoder().encode("Content-Encoding: nonce\0"), 1]);
  const nonce = new Uint8Array(await crypto.subtle.sign("HMAC", prk2Key, nonceInfo)).slice(0, 12);

  const paddedPayload = new Uint8Array([...new TextEncoder().encode(payloadStr), 2]);

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, paddedPayload));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, paddedPayload.length + 16 + 1, false);

  const header = new Uint8Array([...salt, ...rs, localPubRaw.length, ...localPubRaw]);
  return new Uint8Array([...header, ...encrypted]);
}

async function sendWebPush(endpoint: string, p256dh: string, auth: string, payload: string, vapidPub: string, vapidPriv: string): Promise<boolean> {
  try {
    const url = new URL(endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await createVapidJwt(audience, "mailto:funchat@lovable.app", vapidPriv, vapidPub);
    const body = await encryptPayload(payload, p256dh, auth);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        Authorization: `vapid t=${jwt}, k=${vapidPub}`,
        TTL: "86400",
        Urgency: "high",
      },
      body,
    });

    if (res.status === 201 || res.status === 200) return true;
    if (res.status === 404 || res.status === 410) return false;
    console.error(`Push failed: ${res.status} ${await res.text()}`);
    return true;
  } catch (err) {
    console.error("Push send error:", err);
    return true;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = getServiceClient();
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // GET vapid-key
    if (req.method === "GET" && action === "vapid-key") {
      const keys = await getOrCreateVapidKeys(supabaseAdmin);
      return new Response(JSON.stringify({ publicKey: keys.public_key }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth required for other actions
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = getUserClient(authHeader);
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    if (action === "subscribe") {
      const { endpoint, p256dh, auth: authKey } = body;
      if (!endpoint || !p256dh || !authKey) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await supabaseAdmin
        .from("push_subscriptions").select("id").eq("endpoint", endpoint).maybeSingle();

      if (existing) {
        await supabaseAdmin.from("push_subscriptions").update({ user_id: user.id, p256dh, auth: authKey }).eq("endpoint", endpoint);
      } else {
        await supabaseAdmin.from("push_subscriptions").insert({ user_id: user.id, endpoint, p256dh, auth: authKey });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "unsubscribe") {
      await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", body.endpoint).eq("user_id", user.id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send") {
      const { conversationId, title, body: notifBody } = body;
      if (!conversationId) {
        return new Response(JSON.stringify({ error: "Missing conversationId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const keys = await getOrCreateVapidKeys(supabaseAdmin);

      const { data: members } = await supabaseAdmin
        .from("conversation_members").select("user_id")
        .eq("conversation_id", conversationId).neq("user_id", user.id);

      if (!members || members.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: subs } = await supabaseAdmin
        .from("push_subscriptions").select("endpoint, p256dh, auth")
        .in("user_id", members.map((m) => m.user_id));

      if (!subs || subs.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = JSON.stringify({ title: title || "FUN Chat", body: notifBody || "New message", url: "/" });
      let sent = 0;
      const expired: string[] = [];

      for (const sub of subs) {
        const ok = await sendWebPush(sub.endpoint, sub.p256dh, sub.auth, payload, keys.public_key, keys.private_key);
        if (ok) sent++; else expired.push(sub.endpoint);
      }

      if (expired.length > 0) {
        await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", expired);
      }

      return new Response(JSON.stringify({ sent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Push error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
