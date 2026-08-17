export type OtpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

export type AccountCategory = 'all' | 'work' | 'personal' | 'finance' | 'social' | 'other';

export interface TotpAccount {
  id: string;
  issuer: string;
  accountName: string;
  secret: string; // Base32 encoded key
  algorithm: OtpAlgorithm;
  digits: number; // usually 6 or 8
  period: number; // usually 30 seconds
  category: 'work' | 'personal' | 'finance' | 'social' | 'other';
  pinned?: boolean;
  icon?: string;
  customColor?: string;
  createdAt: number;
  updatedAt: number;
}

export interface EncryptedPayload {
  version: number;
  salt: string;
  iv: string;
  cipherText: string;
}

export interface UserSession {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  provider: 'local' | 'google' | 'apple' | 'telegram';
}

export interface CloudSyncConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  enabled: boolean;
  autoSync: boolean;
  lastSyncedAt?: number;
}
