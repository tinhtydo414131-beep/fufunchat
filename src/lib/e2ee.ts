/**
 * End-to-End Encryption utilities using libsodium (X25519 + XSalsa20-Poly1305)
 *
 * Flow:
 * 1. Each user generates an X25519 keypair on first use
 * 2. Public key is stored in `user_keys` table
 * 3. Private key is stored in IndexedDB (never leaves the device)
 * 4. To send an encrypted message:
 *    - Derive shared secret from sender's private key + recipient's public key
 *    - Encrypt with crypto_box_easy (XSalsa20-Poly1305)
 *    - Store as base64 with "e2ee:" prefix
 * 5. To decrypt:
 *    - Derive shared secret from recipient's private key + sender's public key
 *    - Decrypt with crypto_box_open_easy
 */

import _sodium from "libsodium-wrappers-sumo";

let sodiumReady: Promise<typeof _sodium> | null = null;

export async function getSodium() {
  if (!sodiumReady) {
    sodiumReady = _sodium.ready.then(() => _sodium);
  }
  return sodiumReady;
}

// ── Key Management ──

export interface E2EEKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export async function generateKeyPair(): Promise<E2EEKeyPair> {
  const sodium = await getSodium();
  const kp = sodium.crypto_box_keypair();
  return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}

// ── IndexedDB storage for private key ──

const DB_NAME = "funchat_e2ee";
const STORE_NAME = "keys";
const PRIVATE_KEY_ID = "my_private_key";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function storePrivateKey(privateKey: Uint8Array): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ id: PRIVATE_KEY_ID, key: Array.from(privateKey) });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadPrivateKey(): Promise<Uint8Array | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(PRIVATE_KEY_ID);
    req.onsuccess = () => {
      if (req.result?.key) {
        resolve(new Uint8Array(req.result.key));
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Encryption / Decryption ──

const E2EE_PREFIX = "e2ee:";

export function isEncryptedMessage(content: string | null): boolean {
  return !!content?.startsWith(E2EE_PREFIX);
}

/**
 * Encrypt a plaintext message for a recipient.
 * Returns base64-encoded ciphertext prefixed with "e2ee:"
 */
export async function encryptMessage(
  plaintext: string,
  senderPrivateKey: Uint8Array,
  recipientPublicKey: Uint8Array
): Promise<string> {
  const sodium = await getSodium();
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  const message = sodium.from_string(plaintext);
  const ciphertext = sodium.crypto_box_easy(message, nonce, recipientPublicKey, senderPrivateKey);

  // Pack nonce + ciphertext together
  const packed = new Uint8Array(nonce.length + ciphertext.length);
  packed.set(nonce);
  packed.set(ciphertext, nonce.length);

  return E2EE_PREFIX + sodium.to_base64(packed, sodium.base64_variants.ORIGINAL);
}

/**
 * Decrypt an encrypted message from a sender.
 * Input should be the full "e2ee:..." string.
 */
export async function decryptMessage(
  encryptedContent: string,
  recipientPrivateKey: Uint8Array,
  senderPublicKey: Uint8Array
): Promise<string> {
  const sodium = await getSodium();
  const b64 = encryptedContent.slice(E2EE_PREFIX.length);
  const packed = sodium.from_base64(b64, sodium.base64_variants.ORIGINAL);

  const nonce = packed.slice(0, sodium.crypto_box_NONCEBYTES);
  const ciphertext = packed.slice(sodium.crypto_box_NONCEBYTES);

  const plaintext = sodium.crypto_box_open_easy(ciphertext, nonce, senderPublicKey, recipientPrivateKey);
  return sodium.to_string(plaintext);
}

/**
 * Convert key to/from base64 for storage in database
 */
export async function keyToBase64(key: Uint8Array): Promise<string> {
  const sodium = await getSodium();
  return sodium.to_base64(key, sodium.base64_variants.ORIGINAL);
}

export async function base64ToKey(b64: string): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.from_base64(b64, sodium.base64_variants.ORIGINAL);
}
