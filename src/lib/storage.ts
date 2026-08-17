import { TotpAccount, CloudSyncConfig, UserSession } from '../types/auth';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'vaultauth_accounts_v1';
const PIN_HASH_KEY = 'vaultauth_pin_hash_v1';
const SYNC_CONFIG_KEY = 'vaultauth_sync_config_v1';
const USER_SESSION_KEY = 'vaultauth_session_v1';

const DEFAULT_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://cszarmfcbwargdzopfxd.supabase.co';
const DEFAULT_SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_hhVuX7PZqhd6rqFNCzSkwQ_TxOkRRvp';

// Seed demo accounts for immediate delight on first run
export const DEMO_ACCOUNTS: TotpAccount[] = [
  {
    id: 'demo-github',
    issuer: 'GitHub',
    accountName: 'developer@example.com',
    secret: 'JBSWY3DPEHPK3PXP',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    category: 'work',
    pinned: true,
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000 * 5
  },
  {
    id: 'demo-google',
    issuer: 'Google',
    accountName: 'personal.email@gmail.com',
    secret: 'HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    category: 'personal',
    pinned: true,
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 86400000 * 3
  },
  {
    id: 'demo-telegram',
    issuer: 'Telegram',
    accountName: '+998 90 123 45 67',
    secret: 'MZXW6YTBOI======',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    category: 'social',
    pinned: false,
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000 * 2
  },
  {
    id: 'demo-binance',
    issuer: 'Binance',
    accountName: 'crypto_trader',
    secret: 'NBSWY3DPEHPK3PXP',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    category: 'finance',
    pinned: false,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000
  }
];

export class StorageService {
  /**
   * Get all stored TOTP accounts
   */
  static getAccounts(): TotpAccount[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.saveAccounts(DEMO_ACCOUNTS);
        return DEMO_ACCOUNTS;
      }
      return JSON.parse(raw);
    } catch {
      return DEMO_ACCOUNTS;
    }
  }

  /**
   * Save TOTP accounts to local storage
   */
  static saveAccounts(accounts: TotpAccount[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    window.dispatchEvent(new Event('vaultauth_accounts_updated'));
  }

  /**
   * Add or update an account
   */
  static upsertAccount(account: TotpAccount): void {
    const current = this.getAccounts();
    const index = current.findIndex(a => a.id === account.id);
    if (index >= 0) {
      current[index] = { ...account, updatedAt: Date.now() };
    } else {
      current.unshift({ ...account, createdAt: Date.now(), updatedAt: Date.now() });
    }
    this.saveAccounts(current);
  }

  /**
   * Delete an account by ID
   */
  static deleteAccount(id: string): void {
    const current = this.getAccounts().filter(a => a.id !== id);
    this.saveAccounts(current);
  }

  /**
   * Toggle pinned status
   */
  static togglePin(id: string): void {
    const current = this.getAccounts();
    const target = current.find(a => a.id === id);
    if (target) {
      target.pinned = !target.pinned;
      target.updatedAt = Date.now();
      this.saveAccounts(current);
    }
  }

  /**
   * PIN lock settings
   */
  static getPinHash(): string | null {
    return localStorage.getItem(PIN_HASH_KEY);
  }

  static setPinHash(hash: string | null): void {
    if (hash) {
      localStorage.setItem(PIN_HASH_KEY, hash);
    } else {
      localStorage.removeItem(PIN_HASH_KEY);
    }
  }

  /**
   * User session
   */
  static getUserSession(): UserSession | null {
    try {
      const raw = localStorage.getItem(USER_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  static setUserSession(session: UserSession | null): void {
    if (session) {
      localStorage.setItem(USER_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(USER_SESSION_KEY);
    }
  }

  /**
   * Cloud sync config (Supabase)
   */
  static getSyncConfig(): CloudSyncConfig {
    try {
      const raw = localStorage.getItem(SYNC_CONFIG_KEY);
      return raw ? JSON.parse(raw) : {
        supabaseUrl: DEFAULT_SUPABASE_URL,
        supabaseAnonKey: DEFAULT_SUPABASE_KEY,
        enabled: true,
        autoSync: true
      };
    } catch {
      return {
        supabaseUrl: DEFAULT_SUPABASE_URL,
        supabaseAnonKey: DEFAULT_SUPABASE_KEY,
        enabled: true,
        autoSync: true
      };
    }
  }

  static saveSyncConfig(config: CloudSyncConfig): void {
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
  }
}

/**
 * Initialize Supabase Client dynamically
 */
let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(url?: string, key?: string): SupabaseClient | null {
  const targetUrl = url || StorageService.getSyncConfig().supabaseUrl || DEFAULT_SUPABASE_URL;
  const targetKey = key || StorageService.getSyncConfig().supabaseAnonKey || DEFAULT_SUPABASE_KEY;

  if (targetUrl && targetKey) {
    try {
      if (!supabaseInstance || (url && key)) {
        supabaseInstance = createClient(targetUrl, targetKey);
      }
      return supabaseInstance;
    } catch {
      return null;
    }
  }

  return null;
}
