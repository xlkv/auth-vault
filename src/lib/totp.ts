import { OtpAlgorithm } from '../types/auth';

/**
 * Base32 character set per RFC 4648
 */
const RFC4648_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decode Base32 string to Uint8Array
 */
export function base32Decode(input: string): Uint8Array {
  const cleaned = input.toUpperCase().replace(/[\s=-]/g, '');
  if (!cleaned) {
    throw new Error('Empty or invalid Base32 secret key');
  }

  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const val = RFC4648_ALPHABET.indexOf(char);
    if (val === -1) {
      throw new Error(`Invalid Base32 character encountered: ${char}`);
    }

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

/**
 * Get hash algorithm identifier for Web Crypto API
 */
function getWebCryptoAlgorithm(algorithm: OtpAlgorithm): string {
  switch (algorithm) {
    case 'SHA256':
      return 'SHA-256';
    case 'SHA512':
      return 'SHA-512';
    case 'SHA1':
    default:
      return 'SHA-1';
  }
}

/**
 * Generate RFC 6238 Time-based One-Time Password (TOTP)
 */
export async function generateTotp(
  secret: string,
  options: {
    timestamp?: number;
    period?: number;
    digits?: number;
    algorithm?: OtpAlgorithm;
  } = {}
): Promise<string> {
  const {
    timestamp = Date.now(),
    period = 30,
    digits = 6,
    algorithm = 'SHA1'
  } = options;

  const keyBytes = base32Decode(secret);
  const epoch = Math.floor(timestamp / 1000);
  const counter = Math.floor(epoch / period);

  // Counter to 8-byte big-endian ArrayBuffer
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setBigUint64(0, BigInt(counter), false); // Big-endian

  // Import HMAC key via Web Crypto API
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    {
      name: 'HMAC',
      hash: { name: getWebCryptoAlgorithm(algorithm) }
    },
    false,
    ['sign']
  );

  // Sign counter
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hashBytes = new Uint8Array(signature);

  // Dynamic truncation (RFC 4226)
  const offset = hashBytes[hashBytes.length - 1] & 0x0f;
  const binaryCode =
    ((hashBytes[offset] & 0x7f) << 24) |
    ((hashBytes[offset + 1] & 0xff) << 16) |
    ((hashBytes[offset + 2] & 0xff) << 8) |
    (hashBytes[offset + 3] & 0xff);

  const otp = binaryCode % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

/**
 * Calculate time remaining and progress percentage for the current 30s window
 */
export function getTimeRemaining(period = 30): {
  secondsLeft: number;
  progress: number; // 0 to 1
  isExpiringSoon: boolean;
} {
  const epoch = Math.floor(Date.now() / 1000);
  const secondsLeft = period - (epoch % period);
  const progress = secondsLeft / period;
  return {
    secondsLeft,
    progress,
    isExpiringSoon: secondsLeft <= 7
  };
}

/**
 * Format 6-digit or 8-digit OTP code nicely for display (e.g. "123 456" or "1234 5678")
 */
export function formatOtpCode(code: string): { left: string; right: string } {
  if (code.length === 6) {
    return {
      left: code.slice(0, 3),
      right: code.slice(3)
    };
  }
  if (code.length === 8) {
    return {
      left: code.slice(0, 4),
      right: code.slice(4)
    };
  }
  return {
    left: code,
    right: ''
  };
}
