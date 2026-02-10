import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CH = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const J = { ...CH, "Content-Type": "application/json" };
function b64e(d: Uint8Array): string { let b=""; for (const v of d) b+=String.fromCharCode(v); return btoa(b).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }
function b64d(s: string): Uint8Array { const p="=".repeat((4-(s.length%4))%4); const b=(s+p).replace(/-/g,"+").replace(/_/g,"/"); const r=atob(b); const o=new Uint8Array(r.length); for(let i=0;i<r.length;i++)o[i]=r.charCodeAt(i); return o; }

Deno.serve(async (req: Request) => {
  if (req.method==="OPTIONS") return new Response(null,{headers:CH});
  try {
    const sa=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const action=new URL(req.url).searchParams.get("action");
    if (action==="vapid-key") {
      const {data}=await sa.from("vapid_keys").select("public_key,private_key").eq("id",1).maybeSingle();
      if (data) return new Response(JSON.stringify({publicKey:data.public_key}),{headers:J});
      const kp=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
      const pub=new Uint8Array(await crypto.subtle.exportKey("raw",kp.publicKey));
      const prv=await crypto.subtle.exportKey("jwk",kp.privateKey);
      const pk=b64e(pub);
      await sa.from("vapid_keys").insert({id:1,public_key:pk,private_key:prv.d!});
      return new Response(JSON.stringify({publicKey:pk}),{headers:J});
    }
    const ah=req.headers.get("Authorization");
    if(!ah) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:J});
    const su=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:ah}}});
    const {data:ud}=await su.auth.getUser();
    if(!ud?.user) return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:J});
    const uid=ud.user.id; const body=await req.json();
    if (action==="subscribe") {
      if(!body.endpoint||!body.p256dh||!body.auth) return new Response(JSON.stringify({error:"Missing"}),{status:400,headers:J});
      const {data:ex}=await sa.from("push_subscriptions").select("id").eq("endpoint",body.endpoint).maybeSingle();
      if(ex) await sa.from("push_subscriptions").update({user_id:uid,p256dh:body.p256dh,auth:body.auth}).eq("endpoint",body.endpoint);
      else await sa.from("push_subscriptions").insert({user_id:uid,endpoint:body.endpoint,p256dh:body.p256dh,auth:body.auth});
      return new Response(JSON.stringify({success:true}),{headers:J});
    }
    if (action==="send") {
      if(!body.conversationId) return new Response(JSON.stringify({error:"Missing cid"}),{status:400,headers:J});
      const {data:vd}=await sa.from("vapid_keys").select("public_key,private_key").eq("id",1).maybeSingle();
      if(!vd) return new Response(JSON.stringify({error:"No VAPID"}),{status:500,headers:J});
      const {data:ms}=await sa.from("conversation_members").select("user_id").eq("conversation_id",body.conversationId).neq("user_id",uid);
      if(!ms?.length) return new Response(JSON.stringify({sent:0}),{headers:J});
      const {data:ss}=await sa.from("push_subscriptions").select("endpoint,p256dh,auth").in("user_id",ms.map((m:{user_id:string})=>m.user_id));
      if(!ss?.length) return new Response(JSON.stringify({sent:0}),{headers:J});
      const pl=JSON.stringify({title:body.title||"FUN Chat",body:body.body||"New message",url:"/"});
      let sent=0; const exp:string[]=[];
      for(const s of ss){try{
        const ep=new URL(s.endpoint); const aud=`${ep.protocol}//${ep.host}`;
        const pkb=b64d(vd.public_key); const x=b64e(pkb.slice(1,33)); const y=b64e(pkb.slice(33,65));
        const pk=await crypto.subtle.importKey("jwk",{kty:"EC",crv:"P-256",x,y,d:vd.private_key},{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
        const hd=b64e(new TextEncoder().encode(JSON.stringify({typ:"JWT",alg:"ES256"})));
        const now=Math.floor(Date.now()/1000);
        const pd=b64e(new TextEncoder().encode(JSON.stringify({aud,exp:now+86400,sub:"mailto:funchat@lovable.app"})));
        const inp=`${hd}.${pd}`;
        const sg=new Uint8Array(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},pk,new TextEncoder().encode(inp)));
        let rs=sg; if(sg.length!==64){rs=new Uint8Array(64);let o=2;const rl=sg[o+1];o+=2;const r1=rl===33?o+1:o;const ra=rl===33?32:rl;rs.set(sg.slice(r1,r1+ra),32-ra);o+=rl;const sl2=sg[o+1];o+=2;const s1=sl2===33?o+1:o;const sa2=sl2===33?32:sl2;rs.set(sg.slice(s1,s1+sa2),64-sa2);}
        const jwt=`${inp}.${b64e(rs)}`;
        const upb=b64d(s.p256dh); const as2=b64d(s.auth);
        const upk=await crypto.subtle.importKey("raw",upb,{name:"ECDH",namedCurve:"P-256"},false,[]);
        const lk=await crypto.subtle.generateKey({name:"ECDH",namedCurve:"P-256"},true,["deriveBits"]);
        const sh=new Uint8Array(await crypto.subtle.deriveBits({name:"ECDH",public:upk},lk.privateKey,256));
        const lp=new Uint8Array(await crypto.subtle.exportKey("raw",lk.publicKey));
        const pk1=await crypto.subtle.importKey("raw",as2,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
        const pr=new Uint8Array(await crypto.subtle.sign("HMAC",pk1,sh));
        const inf=new Uint8Array([...new TextEncoder().encode("WebPush: info\0"),...upb,...lp,1]);
        const ik=await crypto.subtle.importKey("raw",pr,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
        const im=new Uint8Array(await crypto.subtle.sign("HMAC",ik,inf)).slice(0,32);
        const sl=crypto.getRandomValues(new Uint8Array(16));
        const sk=await crypto.subtle.importKey("raw",sl,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
        const p2=new Uint8Array(await crypto.subtle.sign("HMAC",sk,im));
        const p2k=await crypto.subtle.importKey("raw",p2,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
        const ci=new Uint8Array([...new TextEncoder().encode("Content-Encoding: aes128gcm\0"),1]);
        const ck=new Uint8Array(await crypto.subtle.sign("HMAC",p2k,ci)).slice(0,16);
        const ni=new Uint8Array([...new TextEncoder().encode("Content-Encoding: nonce\0"),1]);
        const nc=new Uint8Array(await crypto.subtle.sign("HMAC",p2k,ni)).slice(0,12);
        const pp=new Uint8Array([...new TextEncoder().encode(pl),2]);
        const ak=await crypto.subtle.importKey("raw",ck,"AES-GCM",false,["encrypt"]);
        const en=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv:nc},ak,pp));
        const rv=new Uint8Array(4); new DataView(rv.buffer).setUint32(0,pp.length+16+1,false);
        const hb=new Uint8Array([...sl,...rv,lp.length,...lp]);
        const pb=new Uint8Array([...hb,...en]);
        const r=await fetch(s.endpoint,{method:"POST",headers:{"Content-Type":"application/octet-stream","Content-Encoding":"aes128gcm",Authorization:`vapid t=${jwt}, k=${vd.public_key}`,TTL:"86400",Urgency:"high"},body:pb});
        if(r.status===201||r.status===200)sent++;else if(r.status===404||r.status===410)exp.push(s.endpoint);
      }catch(e){console.error("Push err:",e);}}
      if(exp.length)await sa.from("push_subscriptions").delete().in("endpoint",exp);
      return new Response(JSON.stringify({sent}),{headers:J});
    }
    return new Response(JSON.stringify({error:"Unknown"}),{status:400,headers:J});
  }catch(e){console.error(e);return new Response(JSON.stringify({error:(e as Error).message}),{status:500,headers:J});}
});
