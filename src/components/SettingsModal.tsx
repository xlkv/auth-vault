import React, { useState } from 'react';
import { X, Lock, Key, Download, Upload, Cloud, Send, CheckCircle } from 'lucide-react';
import { TotpAccount, CloudSyncConfig, UserSession } from '../types/auth';
import { StorageService } from '../lib/storage';
import { encryptVault, decryptVault, hashPin } from '../lib/crypto';
import { parseBackupFile } from '../lib/parser';
import confetti from 'canvas-confetti';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: TotpAccount[];
  onImportAccounts: (imported: TotpAccount[]) => void;
  hasPin: boolean;
  onPinChange: (newPin: string | null) => void;
  syncConfig: CloudSyncConfig;
  onSaveSyncConfig: (config: CloudSyncConfig) => void;
  userSession: UserSession | null;
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  isTelegram: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onImportAccounts,
  hasPin,
  onPinChange,
  syncConfig,
  onSaveSyncConfig,
  onShowToast,
  isTelegram
}) => {
  const [activeTab, setActiveTab] = useState<'security' | 'cloud' | 'backup' | 'telegram'>('security');

  // PIN settings state
  const [pinInput, setPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [masterPassword, setMasterPassword] = useState('');

  // Cloud config state
  const [supabaseUrl, setSupabaseUrl] = useState(syncConfig.supabaseUrl || '');
  const [supabaseKey, setSupabaseKey] = useState(syncConfig.supabaseAnonKey || '');
  const [syncEnabled, setSyncEnabled] = useState(syncConfig.enabled || false);

  if (!isOpen) return null;

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.length < 4) {
      onShowToast('PIN code must be at least 4 digits', 'error');
      return;
    }
    if (pinInput !== confirmPinInput) {
      onShowToast('PIN codes do not match', 'error');
      return;
    }

    const hash = await hashPin(pinInput);
    StorageService.setPinHash(hash);
    onPinChange(pinInput);
    setPinInput('');
    setConfirmPinInput('');
    onShowToast('PIN lock enabled successfully!', 'success');
  };

  const handleRemovePin = () => {
    if (window.confirm('Are you sure you want to disable PIN lock?')) {
      StorageService.setPinHash(null);
      onPinChange(null);
      onShowToast('PIN lock disabled', 'info');
    }
  };

  // Export encrypted backup
  const handleExportEncrypted = async () => {
    if (!masterPassword) {
      onShowToast('Please enter a password to encrypt your backup', 'error');
      return;
    }

    try {
      const encrypted = await encryptVault(accounts, masterPassword);
      const blob = new Blob([encrypted], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vaultauth-backup-encrypted-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMasterPassword('');
      confetti({ particleCount: 50, spread: 60 });
      onShowToast('Encrypted backup downloaded!', 'success');
    } catch {
      onShowToast('Failed to encrypt backup', 'error');
    }
  };

  // Export unencrypted backup
  const handleExportPlain = () => {
    const blob = new Blob([JSON.stringify(accounts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vaultauth-backup-plain-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('Backup downloaded successfully', 'info');
  };

  // Import file
  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      try {
        // Check if encrypted
        if (content.includes('"cipherText"') && content.includes('"salt"')) {
          const pass = prompt('This backup is encrypted. Enter the Master Password:');
          if (!pass) return;
          const decrypted = await decryptVault(content, pass);
          onImportAccounts(decrypted);
          confetti({ particleCount: 70, spread: 70 });
          onShowToast(`Imported ${decrypted.length} accounts!`, 'success');
        } else {
          const parsed = parseBackupFile(content);
          onImportAccounts(parsed);
          confetti({ particleCount: 70, spread: 70 });
          onShowToast(`Imported ${parsed.length} accounts!`, 'success');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to import';
        onShowToast(msg, 'error');
      }
    };
    reader.readAsText(file);
  };

  // Save Cloud Sync Config
  const handleSaveCloud = (e: React.FormEvent) => {
    e.preventDefault();
    const newConfig: CloudSyncConfig = {
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseKey.trim(),
      enabled: syncEnabled,
      autoSync: true,
      lastSyncedAt: Date.now()
    };
    onSaveSyncConfig(newConfig);
    onShowToast('Cloud Sync settings saved!', 'success');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Settings & Cloud</h2>
          <button className="btn-icon-only" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-tabs">
            <button
              className={`modal-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <Lock size={15} /> Security
            </button>
            <button
              className={`modal-tab-btn ${activeTab === 'cloud' ? 'active' : ''}`}
              onClick={() => setActiveTab('cloud')}
            >
              <Cloud size={15} /> Cloud Sync
            </button>
            <button
              className={`modal-tab-btn ${activeTab === 'backup' ? 'active' : ''}`}
              onClick={() => setActiveTab('backup')}
            >
              <Download size={15} /> Backup
            </button>
            <button
              className={`modal-tab-btn ${activeTab === 'telegram' ? 'active' : ''}`}
              onClick={() => setActiveTab('telegram')}
            >
              <Send size={15} /> Telegram
            </button>
          </div>

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  App Lock (PIN Protection)
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Require a PIN code to unlock your 2FA codes whenever you open the app.
                </p>
              </div>

              {hasPin ? (
                <div
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-emerald)' }}>
                    <CheckCircle size={18} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>PIN Lock is Active</span>
                  </div>
                  <button className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem' }} onClick={handleRemovePin}>
                    Disable PIN
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSetPin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Set 4 to 6 digit PIN</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      className="form-input"
                      placeholder="••••"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Confirm PIN</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      className="form-input"
                      placeholder="••••"
                      value={confirmPinInput}
                      onChange={(e) => setConfirmPinInput(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ marginTop: '0.25rem' }}>
                    <Key size={16} /> Enable PIN Lock
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Cloud Sync Tab */}
          {activeTab === 'cloud' && (
            <form onSubmit={handleSaveCloud} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Cloud Synchronization (Supabase / Google)
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Connect your free Supabase project to enable automatic multi-device sync with Google OAuth.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Supabase Project URL</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="https://xyzcompany.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Supabase Anon Key</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={syncEnabled}
                  onChange={(e) => setSyncEnabled(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent-emerald)' }}
                />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Enable Cloud Sync</span>
              </label>

              <button type="submit" className="btn btn-primary">
                Save Cloud Configuration
              </button>
            </form>
          )}

          {/* Backup & Portability Tab */}
          {activeTab === 'backup' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Encrypted Vault Backup (Recommended)
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Protects your 2FA seeds with AES-256-GCM encryption.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Master password for encryption..."
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={handleExportEncrypted}>
                  <Download size={16} /> Export
                </button>
              </div>

              <hr style={{ borderColor: 'var(--border-subtle)', margin: '0.5rem 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Plain JSON Export
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Unencrypted format (Keep file safe!)
                  </p>
                </div>
                <button className="btn btn-secondary" onClick={handleExportPlain}>
                  Export Plain
                </button>
              </div>

              <hr style={{ borderColor: 'var(--border-subtle)', margin: '0.5rem 0' }} />

              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  Restore / Import Backup
                </p>
                <label className="btn btn-secondary" style={{ width: '100%', cursor: 'pointer' }}>
                  <Upload size={16} /> Select Backup File (JSON / txt)
                  <input
                    type="file"
                    accept=".json,.txt"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleImportFile(e.target.files[0]);
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Telegram Mini App Guide Tab */}
          {activeTab === 'telegram' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                style={{
                  background: 'rgba(34, 158, 217, 0.1)',
                  border: '1px solid rgba(34, 158, 217, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
              >
                <Send size={24} style={{ color: '#229ed9' }} />
                <div>
                  <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                    {isTelegram ? 'Running inside Telegram!' : 'Telegram Mini App Integration Ready'}
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    This web app automatically detects when it is opened inside Telegram.
                  </p>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  How to link to a Telegram Bot:
                </h4>
                <ol
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    paddingLeft: '1.25rem',
                    marginTop: '0.5rem',
                    lineHeight: '1.6'
                  }}
                >
                  <li>Open <strong>@BotFather</strong> on Telegram and send <code>/newbot</code>.</li>
                  <li>Send <code>/newapp</code> to create a Mini App for your bot.</li>
                  <li>Provide your deployed website URL (e.g. from Vercel / Cloudflare).</li>
                  <li>Done! Users can open your authenticator in 1 click inside Telegram.</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
