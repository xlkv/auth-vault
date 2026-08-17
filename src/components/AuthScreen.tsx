import React, { useState } from 'react';
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { AuthService } from '../lib/auth';

interface AuthScreenProps {
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onShowToast
}) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | 'email' | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setLoadingProvider('google');
    const res = await AuthService.signInWithGoogle();
    if (!res.success) {
      setIsLoading(false);
      setLoadingProvider(null);
      onShowToast(res.error || 'Google login failed.', 'error');
    }
  };

  const handleAppleLogin = async () => {
    setIsLoading(true);
    setLoadingProvider('apple');
    const res = await AuthService.signInWithApple();
    if (!res.success) {
      setIsLoading(false);
      setLoadingProvider(null);
      onShowToast(res.error || 'Apple login failed.', 'error');
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      onShowToast('Please enter a valid email address', 'error');
      return;
    }

    setIsLoading(true);
    setLoadingProvider('email');
    const res = await AuthService.signInWithEmail(email.trim());
    setIsLoading(false);
    setLoadingProvider(null);
    if (res.success) {
      setEmailSent(true);
      onShowToast('Magic login link sent! Check your inbox.', 'success');
    } else {
      onShowToast(res.error || 'Failed to send login email', 'error');
    }
  };

  return (
    <div className="pure-auth-container">
      {/* Soft atmospheric backlight */}
      <div className="pure-glow" />

      <main className="pure-auth-content">
        {/* Editorial Headline without boxed badge */}
        <div className="pure-header">
          <h1 className="pure-title">
            Your keys, <br />
            <span className="pure-serif-italic">everywhere you go.</span>
          </h1>
          <p className="pure-desc">Sign in to sync your two-factor codes</p>
        </div>

        {/* Borderless Action Stack */}
        <div className="pure-actions">
          {/* Google Button */}
          <button
            type="button"
            className="pure-btn pure-btn-google"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            {loadingProvider === 'google' ? (
              <span className="pure-spinner-dark" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" className="pure-logo">
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
            )}
            <span className="pure-btn-label">
              {loadingProvider === 'google' ? 'Connecting Google...' : 'Continue with Google'}
            </span>
          </button>

          {/* Apple Button */}
          <button
            type="button"
            className="pure-btn pure-btn-apple"
            onClick={handleAppleLogin}
            disabled={isLoading}
          >
            {loadingProvider === 'apple' ? (
              <span className="pure-spinner-light" />
            ) : (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" className="pure-logo">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.65 1.35-.58.66-1.09 1.73-.95 2.76 1.01.08 2.05-.51 2.68-1.26z" />
              </svg>
            )}
            <span className="pure-btn-label">
              {loadingProvider === 'apple' ? 'Connecting Apple...' : 'Continue with Apple'}
            </span>
          </button>

          {/* Minimalist Borderless Divider */}
          <div className="pure-divider">
            <span className="pure-divider-text">or with email</span>
          </div>

          {/* Email Form */}
          {emailSent ? (
            <div className="pure-sent-box">
              <CheckCircle2 size={18} className="pure-sent-icon" />
              <span>Login link sent! Check your inbox for <b>{email}</b>.</span>
            </div>
          ) : (
            <form onSubmit={handleEmailLogin} className="pure-email-form">
              <div className="pure-input-box">
                <Mail size={16} className="pure-input-icon" />
                <input
                  type="email"
                  className="pure-input"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <button
                  type="submit"
                  className="pure-submit-btn"
                  disabled={isLoading || !email.trim()}
                  title="Send login link"
                >
                  {loadingProvider === 'email' ? (
                    <span className="pure-spinner-sm" />
                  ) : (
                    <ArrowRight size={15} strokeWidth={2.4} />
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};
