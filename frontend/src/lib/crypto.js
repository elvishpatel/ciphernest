/**
 * CipherNest — Client-Side Encryption Engine
 * 
 * Zero-knowledge: all encryption/decryption happens HERE.
 * Server never sees master password, plaintext, or encryption keys.
 * 
 * Flow:
 *   Master Password → Argon2id → Master Key
 *   Master Key → HKDF → Auth Key (sent to server as hash)
 *   Master Key → HKDF → Encryption Key (never leaves client)
 *   Encryption Key → per-vault keys → per-entry AES-256-GCM
 */

// ─── Argon2id Key Derivation ─────────────────────────────────
export async function deriveKeyFromPassword(password, salt) {
  const { argon2id } = await import('hash-wasm');
  
  const saltBytes = typeof salt === 'string' 
    ? Uint8Array.from(atob(salt), c => c.charCodeAt(0))
    : salt;

  const hashHex = await argon2id({
    password,
    salt: saltBytes,
    iterations: 3,
    memorySize: 65536,   // 64MB memory
    parallelism: 1,
    hashLength: 64,      // 512 bits — split into auth + encryption
    outputType: 'hex',
  });

  // Convert hex string to Uint8Array
  return hexToBytes(hashHex);
}

// ─── Split master key into auth key + encryption key ─────────
export function splitMasterKey(masterKeyBytes) {
  // First 32 bytes → auth key (hashed and sent to server)
  const authKey = masterKeyBytes.slice(0, 32);
  // Last 32 bytes → encryption key (NEVER leaves client)
  const encryptionKey = masterKeyBytes.slice(32, 64);
  return { authKey, encryptionKey };
}

// ─── Convert bytes to hex string ─────────────────────────────
export function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// ─── Convert bytes to base64 ────────────────────────────────
export function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

export function base64ToBytes(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

// ─── Generate random salt ────────────────────────────────────
export function generateSalt(length = 32) {
  return crypto.getRandomValues(new Uint8Array(length));
}

// ─── Generate random IV for AES-GCM ─────────────────────────
function generateIV() {
  return crypto.getRandomValues(new Uint8Array(12));
}

// ─── Import raw key for AES-GCM ─────────────────────────────
async function importKey(keyBytes) {
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── AES-256-GCM Encrypt ────────────────────────────────────
export async function encrypt(plaintext, keyBytes) {
  const encoder = new TextEncoder();
  const iv = generateIV();
  const key = await importKey(keyBytes);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return bytesToBase64(combined);
}

// ─── AES-256-GCM Decrypt ────────────────────────────────────
export async function decrypt(encryptedBase64, keyBytes) {
  const combined = base64ToBytes(encryptedBase64);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const key = await importKey(keyBytes);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

// ─── Encrypt JSON object ────────────────────────────────────
export async function encryptObject(obj, keyBytes) {
  return encrypt(JSON.stringify(obj), keyBytes);
}

// ─── Decrypt to JSON object ─────────────────────────────────
export async function decryptObject(encryptedBase64, keyBytes) {
  const json = await decrypt(encryptedBase64, keyBytes);
  return JSON.parse(json);
}

// ─── HMAC-SHA256 for integrity ──────────────────────────────
export async function generateHMAC(data, keyBytes) {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data)
  );

  return bytesToHex(new Uint8Array(signature));
}

// ─── Verify HMAC ────────────────────────────────────────────
export async function verifyHMAC(data, hmacHex, keyBytes) {
  const computed = await generateHMAC(data, keyBytes);
  // Timing-safe comparison
  if (computed.length !== hmacHex.length) return false;
  let result = 0;
  for (let i = 0; i < computed.length; i++) {
    result |= computed.charCodeAt(i) ^ hmacHex.charCodeAt(i);
  }
  return result === 0;
}

// ─── Derive per-vault key from master encryption key ────────
export async function deriveVaultKey(masterEncKey, vaultId) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    masterEncKey,
    'HKDF',
    false,
    ['deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(vaultId),
      info: new TextEncoder().encode('ciphernest-vault-key'),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const raw = await crypto.subtle.exportKey('raw', derivedKey);
  return new Uint8Array(raw);
}

// ─── Secure Memory Wipe ────────────────────────────────────
export function secureWipe(buffer) {
  if (buffer instanceof Uint8Array) {
    crypto.getRandomValues(buffer); // overwrite with random
    buffer.fill(0);                 // then zero out
  }
}

// ─── Hash auth key for server ───────────────────────────────
export async function hashForServer(authKeyBytes) {
  const hash = await crypto.subtle.digest('SHA-256', authKeyBytes);
  return bytesToHex(new Uint8Array(hash));
}

// ─── Biometric Auth (WebAuthn Simulation via local cache) ───
// This creates a standard WebAuthn credential to trigger the device's native biometric prompt.
export async function setupBiometricAuth(encryptionKeyBytes) {
  if (!encryptionKeyBytes) throw new Error('Encryption key missing. Please unlock vault first.');
  if (!window.PublicKeyCredential) throw new Error('Biometrics not supported on this device/browser.');
  
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  const userId = new Uint8Array(16);
  crypto.getRandomValues(userId);

  const pubKeyCredParams = [
    { type: 'public-key', alg: -7 }, // ES256
    { type: 'public-key', alg: -257 } // RS256
  ];

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'CipherNest', id: window.location.hostname },
      user: { id: userId, name: 'CipherNest User', displayName: 'CipherNest User' },
      pubKeyCredParams,
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60000,
    }
  });

  if (credential) {
    // Store credential ID and the raw encryption key
    // Note: In a true zero-knowledge secure enclave setup, we'd use WebAuthn PRF. 
    // Here we use local storage as the device-bound "secure" storage protected by the biometric check.
    const credIdBase64 = bytesToBase64(new Uint8Array(credential.rawId));
    localStorage.setItem('cn_bio_id', credIdBase64);
    localStorage.setItem('cn_bio_key', bytesToBase64(encryptionKeyBytes));
    return true;
  }
  return false;
}

export async function unlockWithBiometric() {
  const bioIdBase64 = localStorage.getItem('cn_bio_id');
  const bioKeyBase64 = localStorage.getItem('cn_bio_key');
  
  if (!bioIdBase64 || !bioKeyBase64) throw new Error('Biometric auth not set up.');

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  // Trigger biometric prompt
  await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [{ type: 'public-key', id: base64ToBytes(bioIdBase64) }],
      userVerification: 'required',
      timeout: 60000,
    }
  });

  // If we reach here, the user successfully passed the biometric prompt.
  return base64ToBytes(bioKeyBase64);
}

// ─── Zero-Knowledge Recovery System ──────────────────────────

export function generateRecoveryKey() {
  const bytes = new Uint8Array(16); // 128-bit key
  crypto.getRandomValues(bytes);
  const hex = bytesToHex(bytes).toUpperCase();
  return `CPHR-${hex.slice(0,8)}-${hex.slice(8,16)}-${hex.slice(16,24)}-${hex.slice(24,32)}`;
}

export function parseRecoveryKey(keyStr) {
  const clean = keyStr.replace(/^CPHR-/i, '').replace(/-/g, '').toLowerCase();
  if (clean.length !== 32) throw new Error('Invalid recovery key format.');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function hashRecoveryKey(recoveryBytes) {
  const hash = await crypto.subtle.digest('SHA-256', recoveryBytes);
  return bytesToHex(new Uint8Array(hash));
}

export async function encryptWithRecoveryKey(encryptionKeyBytes, recoveryBytes) {
  const importedKey = await crypto.subtle.importKey(
    'raw', recoveryBytes, 'HKDF', false, ['deriveKey']
  );
  
  const salt = new TextEncoder().encode('CipherNestRecoveryV1');
  const derivedAesKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new Uint8Array(0) },
    importedKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    derivedAesKey,
    encryptionKeyBytes
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return bytesToBase64(combined);
}

export async function decryptWithRecoveryKey(blobBase64, recoveryBytes) {
  const combined = base64ToBytes(blobBase64);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const importedKey = await crypto.subtle.importKey(
    'raw', recoveryBytes, 'HKDF', false, ['deriveKey']
  );
  
  const salt = new TextEncoder().encode('CipherNestRecoveryV1');
  const derivedAesKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new Uint8Array(0) },
    importedKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    derivedAesKey,
    ciphertext
  );
  
  return new Uint8Array(decrypted);
}
