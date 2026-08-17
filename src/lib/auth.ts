import { UserSession } from '../types/auth';
import { StorageService, getSupabaseClient } from './storage';
import { isTelegramWebApp, getTelegramUser } from './telegram';

export class AuthService {
  /**
   * Initialize and listen for Supabase auth state changes (OAuth redirects from Google / Apple)
   */
  static initAuthListener(onUserChange: (user: UserSession | null) => void): () => void {
    const supabase = getSupabaseClient();
    if (!supabase) return () => {};

    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = session.user;
        const userSession: UserSession = {
          id: u.id,
          email: u.email,
          name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0],
          avatarUrl: u.user_metadata?.avatar_url || u.user_metadata?.picture,
          provider: (u.app_metadata?.provider as 'google' | 'apple') || 'google'
        };
        StorageService.setUserSession(userSession);
        onUserChange(userSession);
      }
    });

    // 2. Subscribe to auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = session.user;
        const userSession: UserSession = {
          id: u.id,
          email: u.email,
          name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0],
          avatarUrl: u.user_metadata?.avatar_url || u.user_metadata?.picture,
          provider: (u.app_metadata?.provider as 'google' | 'apple') || 'google'
        };
        StorageService.setUserSession(userSession);
        onUserChange(userSession);
      } else {
        const current = StorageService.getUserSession();
        if (current && current.provider !== 'local' && current.provider !== 'telegram') {
          StorageService.setUserSession(null);
          onUserChange(null);
        }
      }
    });

    return () => subscription.unsubscribe();
  }

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
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname
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
   * Sign In with Apple via Supabase OAuth
   */
  static async signInWithApple(): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: window.location.origin + window.location.pathname
        }
      });
      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Apple sign-in failed';
      return { success: false, error: msg };
    }
  }

  /**
   * Sign In with Email Magic Link / OTP
   */
  static async signInWithEmail(email: string): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: window.location.origin + window.location.pathname
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
