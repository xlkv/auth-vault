import { UserSession } from '../types/auth';
import { StorageService, getSupabaseClient } from './storage';
import { isTelegramWebApp, getTelegramUser } from './telegram';

export class AuthService {
  /**
   * Get current active session
   */
  static getSession(): UserSession | null {
    // 1. Check if Telegram WebApp
    if (isTelegramWebApp()) {
      const tgUser = getTelegramUser();
      if (tgUser) {
        return {
          id: `tg_${tgUser.id}`,
          name: tgUser.first_name + (tgUser.last_name ? ` ${tgUser.last_name}` : ''),
          email: tgUser.username ? `@${tgUser.username}` : undefined,
          avatarUrl: tgUser.photo_url,
          provider: 'telegram'
        };
      }
    }

    // 2. Check local stored session
    return StorageService.getUserSession();
  }

  /**
   * Sign In with Google via Supabase OAuth
   */
  static async signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      // Demo Google Auth for local testing if Supabase is not connected yet
      const demoUser: UserSession = {
        id: 'google_user_' + Date.now(),
        email: 'user@gmail.com',
        name: 'Google User',
        provider: 'google',
        avatarUrl: 'https://lh3.googleusercontent.com/a/default-user'
      };
      StorageService.setUserSession(demoUser);
      return { success: true };
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed';
      return { success: false, error: msg };
    }
  }

  /**
   * Sign In with Email Magic Link / OTP
   */
  static async signInWithEmail(email: string): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      // Fallback local session
      const user: UserSession = {
        id: 'email_user_' + Date.now(),
        email: email,
        name: email.split('@')[0],
        provider: 'google'
      };
      StorageService.setUserSession(user);
      return { success: true };
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send login link';
      return { success: false, error: msg };
    }
  }

  /**
   * Continue as Local Guest (no cloud sync)
   */
  static setGuestSession(): void {
    const guest: UserSession = {
      id: 'guest_local',
      name: 'Local Vault',
      provider: 'local'
    };
    StorageService.setUserSession(guest);
  }

  /**
   * Sign Out
   */
  static async signOut(): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    }
    StorageService.setUserSession(null);
  }
}
