import { TotpAccount, EncryptedPayload } from '../types/auth';

/**
 * Convert buffer to Base64 string
 */
function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array
 */
function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive an AES-GCM-256 CryptoKey from password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt Vault accounts with a master password or PIN
 */
export async function encryptVault(
  accounts: TotpAccount[],
  masterPassword: string
): Promise<string> {
  const encoder = new TextEncoder();
  const rawData = encoder.encode(JSON.stringify(accounts));

  // Generate random 16-byte salt and 12-byte IV
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(masterPassword, salt);

  const cipherBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv.buffer as ArrayBuffer
    },
    key,
    rawData
  );

  const payload: EncryptedPayload = {
    version: 1,
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    cipherText: bufferToBase64(cipherBuffer)
  };

  return JSON.stringify(payload);
}

/**
 * Decrypt Vault accounts using master password or PIN
 */
export async function decryptVault(
  encryptedJson: string,
  masterPassword: string
): Promise<TotpAccount[]> {
  const payload: EncryptedPayload = JSON.parse(encryptedJson);

  if (!payload.salt || !payload.iv || !payload.cipherText) {
    throw new Error('Invalid encrypted vault format');
  }

  const salt = base64ToBuffer(payload.salt);
  const iv = base64ToBuffer(payload.iv);
  const cipherBytes = base64ToBuffer(payload.cipherText);

  const key = await deriveKey(masterPassword, salt);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv.buffer as ArrayBuffer
      },
      key,
      cipherBytes.buffer as ArrayBuffer
    );

    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedBuffer);
    return JSON.parse(jsonString) as TotpAccount[];
  } catch {
    throw new Error('Incorrect master password or corrupted vault data');
  }
}

/**
 * Hash PIN for quick unlock checks
 */
export async function hashPin(pin: string, salt: string = 'vault-auth-salt'): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + salt);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return bufferToBase64(hash);
}
