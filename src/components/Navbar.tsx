import React, { useState } from 'react';
import { Shield, Plus, Lock, User, LogOut, Send } from 'lucide-react';
import { UserSession, ThemeMode } from '../types/auth';
import { ThemeSwitcher } from './ThemeSwitcher';

interface NavbarProps {
  onOpenAddModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenAuthModal: () => void;
  onLockVault: () => void;
  onSignOut: () => void;
  hasPin: boolean;
  userSession: UserSession | null;
  isTelegram: boolean;
  currentTheme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAddModal,
  onOpenAuthModal,
  onLockVault,
  onSignOut,
  hasPin,
  userSession,
  isTelegram,
  currentTheme,
  onThemeChange
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="header-nav">
      <div className="header-container">
        {/* Left: Minimal Icon & Theme Switcher (No text title as requested) */}
        <div className="brand-badge">
          <div className="brand-logo-icon" title="VaultAuth">
            <Shield size={16} strokeWidth={2.4} />
          </div>
          <ThemeSwitcher currentTheme={currentTheme} onThemeChange={onThemeChange} />
        </div>

        {/* Right: Header Actions */}
        <div className="header-actions">
          {/* User Profile */}
          {userSession && userSession.provider !== 'local' ? (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="user-profile-chip"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                {userSession.avatarUrl ? (
                  <img src={userSession.avatarUrl} alt="Avatar" className="user-avatar-img" />
                ) : (
                  <div className="user-avatar-placeholder">
                    {userSession.name?.slice(0, 1).toUpperCase() || 'U'}
                  </div>
                )}
                <span className="user-chip-name">{userSession.name || userSession.email}</span>
                {isTelegram && <Send size={10} style={{ color: '#229ed9' }} />}
              </button>

              {showUserMenu && (
                <div className="user-dropdown-menu" onClick={() => setShowUserMenu(false)}>
                  <div className="user-dropdown-header">
                    <p className="user-dropdown-title">{userSession.name}</p>
                    <p className="user-dropdown-sub">{userSession.email || 'Cloud Synced'}</p>
                  </div>
                  <button type="button" className="user-dropdown-item" onClick={onSignOut}>
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button type="button" className="btn btn-auth-trigger" onClick={onOpenAuthModal}>
              <User size={15} />
              <span>Sign In</span>
            </button>
          )}

          {hasPin && (
            <button
              type="button"
              className="btn btn-icon-only"
              onClick={onLockVault}
              title="Lock Vault"
              aria-label="Lock"
            >
              <Lock size={16} />
            </button>
          )}

          <button type="button" className="btn btn-primary btn-add-main" onClick={onOpenAddModal}>
            <Plus size={16} strokeWidth={2.5} />
            <span>Add</span>
          </button>
        </div>
      </div>
    </header>
  );
};
