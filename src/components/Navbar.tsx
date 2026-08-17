import React, { useState } from 'react';
import { Shield, Plus, Lock, User, LogOut, Send } from 'lucide-react';
import { UserSession } from '../types/auth';

interface NavbarProps {
  onOpenAddModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenAuthModal: () => void;
  onLockVault: () => void;
  onSignOut: () => void;
  hasPin: boolean;
  userSession: UserSession | null;
  isTelegram: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAddModal,
  onOpenAuthModal,
  onLockVault,
  onSignOut,
  hasPin,
  userSession,
  isTelegram
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="header-nav">
      <div className="header-container">
        {/* Minimal Brand */}
        <div className="brand-badge">
          <div className="brand-logo-icon">
            <Shield size={18} strokeWidth={2.2} />
          </div>
          <div className="brand-title-group">
            <span className="brand-title">VaultAuth</span>
            <span className="brand-version">v1.0</span>
          </div>
        </div>

        {/* Header Actions */}
        <div className="header-actions">
          {/* User Profile / Sign In */}
          {userSession && userSession.provider !== 'local' ? (
            <div style={{ position: 'relative' }}>
              <button
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
                  <button className="user-dropdown-item" onClick={onSignOut}>
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="btn btn-auth-trigger" onClick={onOpenAuthModal}>
              <User size={15} />
              <span>Sign In</span>
            </button>
          )}

          {hasPin && (
            <button
              className="btn btn-icon-only"
              onClick={onLockVault}
              title="Lock Authenticator"
              aria-label="Lock"
            >
              <Lock size={16} />
            </button>
          )}

          <button className="btn btn-primary" onClick={onOpenAddModal}>
            <Plus size={16} strokeWidth={2.5} />
            <span>Add</span>
          </button>
        </div>
      </div>
    </header>
  );
};
