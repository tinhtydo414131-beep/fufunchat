import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  generateKeyPair,
  storePrivateKey,
  loadPrivateKey,
  keyToBase64,
  base64ToKey,
  encryptMessage,
  decryptMessage,
  isEncryptedMessage,
} from "@/lib/e2ee";

/**
 * Hook to manage E2EE keys and provide encrypt/decrypt functions.
 * - Auto-generates keypair on first use
 * - Stores private key in IndexedDB
 * - Uploads public key to user_keys table
 * - Caches recipient public keys
 */
export function useE2EE() {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [e2eeEnabled, setE2eeEnabled] = useState(false);
  const privateKeyRef = useRef<Uint8Array | null>(null);
  const publicKeyCacheRef = useRef<Map<string, Uint8Array>>(new Map());

  // Initialize keypair
  useEffect(() => {
    if (!user) return;

    const init = async () => {
      try {
        let privKey = await loadPrivateKey();

        if (!privKey) {
          // Generate new keypair
          const kp = await generateKeyPair();
          await storePrivateKey(kp.privateKey);
          privKey = kp.privateKey;

          // Upload public key
          const pubB64 = await keyToBase64(kp.publicKey);
          await (supabase as any).from("user_keys").upsert(
            { user_id: user.id, public_key: pubB64 },
            { onConflict: "user_id" }
          );
        } else {
          // Check if public key exists in DB, upload if missing
          const { data } = await (supabase as any)
            .from("user_keys")
            .select("public_key")
            .eq("user_id", user.id)
            .maybeSingle();

          if (!data) {
            // Regenerate public key from private key (not possible with box keypair)
            // Need to regenerate full keypair
            const kp = await generateKeyPair();
            await storePrivateKey(kp.privateKey);
            privKey = kp.privateKey;
            const pubB64 = await keyToBase64(kp.publicKey);
            await (supabase as any).from("user_keys").upsert(
              { user_id: user.id, public_key: pubB64 },
              { onConflict: "user_id" }
            );
          }
        }

        privateKeyRef.current = privKey;
        setE2eeEnabled(true);
        setReady(true);
      } catch (err) {
        console.error("E2EE init error:", err);
        setReady(true); // Still mark ready so chat works without E2EE
      }
    };

    init();
  }, [user]);

  // Fetch recipient's public key (cached)
  const getRecipientPublicKey = useCallback(async (userId: string): Promise<Uint8Array | null> => {
    const cached = publicKeyCacheRef.current.get(userId);
    if (cached) return cached;

    const { data } = await (supabase as any)
      .from("user_keys")
      .select("public_key")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data?.public_key) return null;

    const key = await base64ToKey(data.public_key as string);
    publicKeyCacheRef.current.set(userId, key);
    return key;
  }, []);

  // Encrypt a message for a specific recipient (1:1 chat)
  const encrypt = useCallback(async (plaintext: string, recipientUserId: string): Promise<string | null> => {
    if (!privateKeyRef.current) return null;

    const recipientPubKey = await getRecipientPublicKey(recipientUserId);
    if (!recipientPubKey) return null;

    try {
      return await encryptMessage(plaintext, privateKeyRef.current, recipientPubKey);
    } catch (err) {
      console.error("Encrypt error:", err);
      return null;
    }
  }, [getRecipientPublicKey]);

  // Decrypt a message from a specific sender
  const decrypt = useCallback(async (encryptedContent: string, senderUserId: string): Promise<string | null> => {
    if (!privateKeyRef.current || !isEncryptedMessage(encryptedContent)) return null;

    const senderPubKey = await getRecipientPublicKey(senderUserId);
    if (!senderPubKey) return null;

    try {
      return await decryptMessage(encryptedContent, privateKeyRef.current, senderPubKey);
    } catch (err) {
      console.error("Decrypt error:", err);
      return null;
    }
  }, [getRecipientPublicKey]);

  return {
    ready,
    e2eeEnabled,
    encrypt,
    decrypt,
    isEncryptedMessage,
  };
}
