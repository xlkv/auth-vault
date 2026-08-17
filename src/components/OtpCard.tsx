import React, { useState, useEffect, useCallback } from 'react';
import { Pin, Trash2, Check } from 'lucide-react';
import { TotpAccount } from '../types/auth';
import { generateTotp, getTimeRemaining, formatOtpCode } from '../lib/totp';
import { detectServiceMeta } from '../lib/services';
import { triggerHaptic } from '../lib/telegram';

interface OtpCardProps {
  account: TotpAccount;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const OtpCard: React.FC<OtpCardProps> = ({
  account,
  onDelete,
  onTogglePin,
  onShowToast
}) => {
  const [code, setCode] = useState<string>('------');
  const [timeInfo, setTimeInfo] = useState(getTimeRemaining(account.period));
  const [copied, setCopied] = useState<boolean>(false);

  const meta = detectServiceMeta(account.issuer, account.accountName);

  const refreshCode = useCallback(async () => {
    try {
      const generated = await generateTotp(account.secret, {
        period: account.period || 30,
        digits: account.digits || 6,
        algorithm: account.algorithm || 'SHA1'
      });
      setCode(generated);
    } catch {
      setCode('ERROR');
    }
  }, [account.secret, account.period, account.digits, account.algorithm]);

  // Initial load & 1-second interval ticker
  useEffect(() => {
    refreshCode();
    const interval = setInterval(() => {
      const remaining = getTimeRemaining(account.period || 30);
      setTimeInfo(remaining);
      if (remaining.secondsLeft === (account.period || 30)) {
        refreshCode();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [account.period, refreshCode]);

  const handleCopy = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (code === '------' || code === 'ERROR') return;

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      triggerHaptic('success');
      onShowToast(`Copied ${account.issuer}`, 'success');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      onShowToast('Could not copy', 'error');
    }
  };

  const { left, right } = formatOtpCode(code);

  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - timeInfo.progress * circumference;

  return (
    <div
      className={`otp-card ${copied ? 'copied' : ''}`}
      onClick={() => handleCopy()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleCopy();
      }}
    >
      <div className="card-header-row">
        <div className="card-issuer-group">
          <div className="service-mini-badge" style={{ borderColor: meta.color }}>
            {account.issuer.slice(0, 2).toUpperCase()}
          </div>
          <div className="service-text-group">
            <div className="service-issuer-title">
              <span>{account.issuer}</span>
              {account.pinned && <Pin size={11} className="pin-icon" fill="currentColor" />}
            </div>
            <span className="service-account-sub">{account.accountName || 'Account'}</span>
          </div>
        </div>

        <div className="card-actions-menu" onClick={(e) => e.stopPropagation()}>
          <button
            className="card-action-btn"
            onClick={() => onTogglePin(account.id)}
            title={account.pinned ? 'Unpin' : 'Pin'}
          >
            <Pin
              size={13}
              style={{
                color: account.pinned ? 'var(--text-primary)' : 'inherit',
                transform: account.pinned ? 'rotate(45deg)' : 'none'
              }}
            />
          </button>
          <button
            className="card-action-btn"
            onClick={() => {
              if (window.confirm(`Delete ${account.issuer}?`)) {
                onDelete(account.id);
                onShowToast(`Deleted ${account.issuer}`, 'info');
              }
            }}
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="card-code-row">
        <div className={`otp-code-text ${timeInfo.isExpiringSoon ? 'expiring' : ''}`}>
          <span>{left}</span>
          <span className="code-split-dot">·</span>
          <span>{right}</span>
        </div>

        <div className="minimal-timer">
          <svg className="timer-svg-mini" viewBox="0 0 24 24">
            <circle className="timer-bg" cx="12" cy="12" r={radius} />
            <circle
              className={`timer-fg ${timeInfo.isExpiringSoon ? 'expiring' : ''}`}
              cx="12"
              cy="12"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <span className={`timer-num ${timeInfo.isExpiringSoon ? 'expiring' : ''}`}>
            {timeInfo.secondsLeft}s
          </span>
        </div>
      </div>

      {copied && (
        <div className="copied-overlay-badge">
          <Check size={13} />
          <span>Copied</span>
        </div>
      )}
    </div>
  );
};
