import { TotpAccount, CloudSyncConfig, UserSession } from '../types/auth';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'vaultauth_accounts_v1';
const PIN_HASH_KEY = 'vaultauth_pin_hash_v1';
const SYNC_CONFIG_KEY = 'vaultauth_sync_config_v1';
const USER_SESSION_KEY = 'vaultauth_session_v1';

const DEFAULT_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://cszarmfcbwargdzopfxd.supabase.co';
const DEFAULT_SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_hhVuX7PZqhd6rqFNCzSkwQ_TxOkRRvp';

export class StorageService {
  /**
   * Get all stored TOTP accounts (filters out any old demo data)
   */
  static getAccounts(): TotpAccount[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed: TotpAccount[] = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      
      // Permanently purge any leftover demo mock accounts
      const clean = parsed.filter(a => a && !a.id.startsWith('demo-'));
      if (clean.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
      }
      return clean;
    } catch {
      return [];
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
   * Clear local accounts (on sign out)
   */
  static clearAccounts(): void {
    localStorage.removeItem(STORAGE_KEY);
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

  /**
   * Fetch vault from Supabase cloud
   */
  static async fetchCloudVault(userId: string): Promise<TotpAccount[] | null> {
    const supabase = getSupabaseClient();
    if (!supabase || !userId) return null;

    try {
      const { data, error } = await supabase
        .from('user_vaults')
        .select('encrypted_vault')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Could not fetch cloud vault:', error.message);
        return null;
      }

      if (data?.encrypted_vault) {
        const parsed = JSON.parse(data.encrypted_vault);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
      return [];
    } catch (err) {
      console.warn('Error reading cloud vault:', err);
      return null;
    }
  }

  /**
   * Push vault to Supabase cloud
   */
  static async pushCloudVault(userId: string, accounts: TotpAccount[]): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase || !userId) return false;

    try {
      const payload = {
        user_id: userId,
        encrypted_vault: JSON.stringify(accounts),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('user_vaults')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) {
        console.warn('Could not sync to cloud:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Error writing cloud vault:', err);
      return false;
    }
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
