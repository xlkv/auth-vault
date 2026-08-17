import React, { useState } from 'react';
import { X, Mail, ArrowRight, ShieldCheck, CheckCircle, Sparkles } from 'lucide-react';
import { AuthService } from '../lib/auth';
import { UserSession } from '../types/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (session: UserSession | null) => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  onShowToast
}) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const res = await AuthService.signInWithGoogle();
    setIsLoading(false);
    if (res.success) {
      const session = AuthService.getSession();
      onAuthSuccess(session);
      onShowToast('Signed in with Google!', 'success');
      onClose();
    } else {
      onShowToast(res.error || 'Google login failed', 'error');
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      onShowToast('Please enter a valid email', 'error');
      return;
    }

    setIsLoading(true);
    const res = await AuthService.signInWithEmail(email.trim());
    setIsLoading(false);
    if (res.success) {
      const session = AuthService.getSession();
      onAuthSuccess(session);
      setEmailSent(true);
      onShowToast('Signed in successfully!', 'success');
      setTimeout(() => {
        onClose();
        setEmailSent(false);
      }, 1200);
    } else {
      onShowToast(res.error || 'Sign in failed', 'error');
    }
  };

  const handleGuestContinue = () => {
    AuthService.setGuestSession();
    onAuthSuccess(AuthService.getSession());
    onShowToast('Using local offline vault', 'info');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <div />
          <button className="btn-icon-only" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ textAlign: 'center', paddingTop: 0 }}>
          <div className="auth-brand-badge">
            <div className="brand-logo-icon" style={{ width: 44, height: 44, borderRadius: 12, margin: '0 auto' }}>
              <ShieldCheck size={26} />
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '1rem', letterSpacing: '-0.02em' }}>
              Welcome to VaultAuth
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              Sync your 2FA accounts across all devices with zero-knowledge encryption.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem' }}>
            {/* Google Sign In Button */}
            <button
              type="button"
              className="btn google-auth-btn"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="auth-divider">
              <span>or sign in with email</span>
            </div>

            {/* Email Magic Link Form */}
            {emailSent ? (
              <div
                style={{
                  background: 'var(--accent-emerald-subtle)',
                  border: '1px solid var(--accent-emerald)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  color: 'var(--accent-emerald)'
                }}
              >
                <CheckCircle size={18} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Signed in successfully!</span>
              </div>
            ) : (
              <form onSubmit={handleEmailLogin} style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Mail
                    size={16}
                    style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  />
                  <input
                    type="email"
                    className="form-input"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ paddingLeft: '2.5rem', width: '100%' }}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ padding: '0.7rem 1rem' }}>
                  <ArrowRight size={16} />
                </button>
              </form>
            )}
          </div>

          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              className="guest-mode-btn"
              onClick={handleGuestContinue}
            >
              <Sparkles size={14} />
              <span>Or continue offline as Guest (Local Vault)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
