import { TotpAccount, OtpAlgorithm } from '../types/auth';

/**
 * Parse an otpauth://totp/ URI into a TotpAccount object
 */
export function parseOtpAuthUri(uriString: string): Partial<TotpAccount> {
  const trimmed = uriString.trim();
  if (!trimmed.startsWith('otpauth://')) {
    throw new Error('Invalid URI: must start with otpauth://');
  }

  const url = new URL(trimmed);
  if (url.hostname.toLowerCase() !== 'totp') {
    throw new Error('Only TOTP (Time-based OTP) is currently supported');
  }

  // Path format: /Issuer:Account or /Account
  const pathname = decodeURIComponent(url.pathname.replace(/^\//, ''));
  let pathIssuer = '';
  let pathAccount = pathname;

  if (pathname.includes(':')) {
    const parts = pathname.split(':');
    pathIssuer = parts[0].trim();
    pathAccount = parts.slice(1).join(':').trim();
  }

  const secret = url.searchParams.get('secret');
  if (!secret) {
    throw new Error('Missing secret parameter in otpauth URI');
  }

  const queryIssuer = url.searchParams.get('issuer');
  const issuer = (queryIssuer || pathIssuer || 'Authenticator').trim();
  const accountName = (pathAccount || 'Account').trim();

  const algorithmRaw = (url.searchParams.get('algorithm') || 'SHA1').toUpperCase();
  let algorithm: OtpAlgorithm = 'SHA1';
  if (algorithmRaw === 'SHA256' || algorithmRaw === 'SHA512') {
    algorithm = algorithmRaw;
  }

  const digits = parseInt(url.searchParams.get('digits') || '6', 10);
  const period = parseInt(url.searchParams.get('period') || '30', 10);

  return {
    id: crypto.randomUUID(),
    issuer,
    accountName,
    secret: secret.replace(/[\s-]/g, '').toUpperCase(),
    algorithm,
    digits: isNaN(digits) ? 6 : digits,
    period: isNaN(period) ? 30 : period,
    category: 'personal',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

/**
 * Parse any raw input string (URI, Base32 key, or multiple lines)
 */
export function parseRawInput(input: string): Partial<TotpAccount> {
  const trimmed = input.trim();
  if (trimmed.startsWith('otpauth://')) {
    return parseOtpAuthUri(trimmed);
  }

  // If it's just a raw secret key (Base32 format)
  const cleanedSecret = trimmed.replace(/[\s-]/g, '').toUpperCase();
  if (/^[A-Z2-7]+=*$/.test(cleanedSecret)) {
    return {
      id: crypto.randomUUID(),
      issuer: 'Custom Account',
      accountName: 'User',
      secret: cleanedSecret,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      category: 'personal',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  throw new Error('Invalid input: please enter a valid otpauth:// link or Base32 secret key');
}

/**
 * Parse backup file content (JSON or text list of URIs)
 */
export function parseBackupFile(content: string): TotpAccount[] {
  try {
    const json = JSON.parse(content);
    
    // VaultAuth native export format
    if (Array.isArray(json)) {
      return json.map(acc => ({
        ...acc,
        id: acc.id || crypto.randomUUID(),
        createdAt: acc.createdAt || Date.now(),
        updatedAt: acc.updatedAt || Date.now()
      }));
    }

    if (json.accounts && Array.isArray(json.accounts)) {
      return json.accounts.map((acc: Partial<TotpAccount>) => ({
        id: acc.id || crypto.randomUUID(),
        issuer: acc.issuer || 'Unknown',
        accountName: acc.accountName || 'Account',
        secret: acc.secret || '',
        algorithm: acc.algorithm || 'SHA1',
        digits: acc.digits || 6,
        period: acc.period || 30,
        category: acc.category || 'personal',
        pinned: acc.pinned || false,
        createdAt: acc.createdAt || Date.now(),
        updatedAt: acc.updatedAt || Date.now()
      }));
    }

    // Bitwarden / 2FAS format compatibility
    if (json.services && Array.isArray(json.services)) {
      return json.services.map((item: { name: string; secret: string; otp?: { account?: string } }) => ({
        id: crypto.randomUUID(),
        issuer: item.name || 'Account',
        accountName: item.otp?.account || '2FA',
        secret: item.secret || '',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        category: 'personal',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }));
    }
  } catch {
    // If not JSON, try parsing as line-by-line otpauth:// URIs
    const lines = content.split('\n');
    const parsed: TotpAccount[] = [];
    for (const line of lines) {
      if (line.trim().startsWith('otpauth://')) {
        try {
          const acc = parseOtpAuthUri(line.trim());
          if (acc.secret && acc.issuer) {
            parsed.push(acc as TotpAccount);
          }
        } catch {
          // Ignore invalid individual lines
        }
      }
    }
    if (parsed.length > 0) return parsed;
  }

  throw new Error('Unsupported backup file format. Expected JSON or otpauth:// list.');
}
