import { useState, useEffect, useMemo, useCallback } from 'react';
import { TotpAccount, AccountCategory, CloudSyncConfig, UserSession } from './types/auth';
import { StorageService } from './lib/storage';
import { AuthService } from './lib/auth';
import { isTelegramWebApp, initTelegramApp, getTelegramUser } from './lib/telegram';
import { Navbar } from './components/Navbar';
import { SearchAndFilter } from './components/SearchAndFilter';
import { OtpCard } from './components/OtpCard';
import { AddAccountModal } from './components/AddAccountModal';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { AuthScreen } from './components/AuthScreen';
import { LockScreen } from './components/LockScreen';
import { ToastContainer, ToastMessage } from './components/Toast';
import { Plus, ShieldAlert, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

export function App() {
  const [accounts, setAccounts] = useState<TotpAccount[]>(() => StorageService.getAccounts());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<AccountCategory>('all');
  const [hasPin, setHasPin] = useState<boolean>(() => !!StorageService.getPinHash());
  const [isLocked, setIsLocked] = useState<boolean>(() => !!StorageService.getPinHash());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [userSession, setUserSession] = useState<UserSession | null>(() => AuthService.getSession());
  const [syncConfig, setSyncConfig] = useState<CloudSyncConfig>(() => StorageService.getSyncConfig());

  const isTelegram = isTelegramWebApp();

  // Toast dispatcher
  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  // Initialize Supabase Auth & Telegram listeners
  useEffect(() => {
    const unsubscribe = AuthService.initAuthListener((user) => {
      setUserSession(user);
      if (user) {
        showToast(`Signed in as ${user.name || user.email}`, 'success');
        // Fetch cloud vault on sign in
        StorageService.fetchCloudVault(user.id).then((cloudAccounts) => {
          if (cloudAccounts && cloudAccounts.length > 0) {
            StorageService.saveAccounts(cloudAccounts);
            setAccounts(cloudAccounts);
          } else {
            const clean = StorageService.getAccounts().filter(a => !a.id.startsWith('demo-'));
            StorageService.saveAccounts(clean);
            setAccounts(clean);
          }
        });
      }
    });

    if (isTelegram) {
      initTelegramApp();
      const tgUser = getTelegramUser();
      if (tgUser && !userSession) {
        const session: UserSession = {
          id: tgUser.id.toString(),
          name: tgUser.first_name,
          email: tgUser.username ? `@${tgUser.username}` : undefined,
          provider: 'telegram',
          avatarUrl: tgUser.photo_url
        };
        setUserSession(session);
        StorageService.setUserSession(session);
      }
    }

    return () => unsubscribe();
  }, [isTelegram, showToast]);

  // Load cloud vault if user is already logged in on initial load
  useEffect(() => {
    if (userSession && userSession.provider !== 'local' && userSession.provider !== 'telegram') {
      StorageService.fetchCloudVault(userSession.id).then((cloudAccounts) => {
        if (cloudAccounts && cloudAccounts.length > 0) {
          StorageService.saveAccounts(cloudAccounts);
          setAccounts(cloudAccounts);
        } else {
          const clean = StorageService.getAccounts().filter(a => !a.id.startsWith('demo-'));
          StorageService.saveAccounts(clean);
          setAccounts(clean);
        }
      });
    }
  }, [userSession]);

  // Sync to cloud helper
  const syncToCloud = useCallback((updatedAccounts: TotpAccount[]) => {
    if (userSession && userSession.provider !== 'local' && userSession.provider !== 'telegram') {
      StorageService.pushCloudVault(userSession.id, updatedAccounts);
    }
  }, [userSession]);

  // Listen for storage updates
  useEffect(() => {
    const handleStorageChange = () => {
      setAccounts(StorageService.getAccounts());
    };
    window.addEventListener('vaultauth_accounts_updated', handleStorageChange);
    return () => window.removeEventListener('vaultauth_accounts_updated', handleStorageChange);
  }, []);

  // Handlers
  const handleAddAccount = (account: TotpAccount) => {
    StorageService.upsertAccount(account);
    const updated = StorageService.getAccounts();
    setAccounts(updated);
    syncToCloud(updated);
    confetti({ particleCount: 40, spread: 50, origin: { y: 0.85 } });
  };

  const handleDeleteAccount = (id: string) => {
    StorageService.deleteAccount(id);
    const updated = StorageService.getAccounts();
    setAccounts(updated);
    syncToCloud(updated);
  };

  const handleTogglePin = (id: string) => {
    StorageService.togglePin(id);
    const updated = StorageService.getAccounts();
    setAccounts(updated);
    syncToCloud(updated);
  };

  const handleImportAccounts = (imported: TotpAccount[]) => {
    const existing = StorageService.getAccounts();
    const map = new Map<string, TotpAccount>();
    existing.forEach((a) => map.set(a.secret, a));
    imported.forEach((a) => map.set(a.secret, a));
    const merged = Array.from(map.values());
    StorageService.saveAccounts(merged);
    setAccounts(merged);
    syncToCloud(merged);
  };

  const handlePinChange = (newPin: string | null) => {
    setHasPin(!!newPin);
    if (!newPin) {
      setIsLocked(false);
    }
  };

  const handleSaveCloud = (config: CloudSyncConfig) => {
    StorageService.saveSyncConfig(config);
    setSyncConfig(config);
  };

  const handleSignOut = async () => {
    StorageService.clearAccounts();
    setAccounts([]);
    await AuthService.signOut();
    setUserSession(null);
    showToast('Signed out', 'info');
  };

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<AccountCategory, number> = {
      all: accounts.length,
      work: 0,
      personal: 0,
      finance: 0,
      social: 0,
      other: 0
    };
    accounts.forEach((acc) => {
      const cat = acc.category || 'other';
      if (counts[cat] !== undefined) {
        counts[cat]++;
      } else {
        counts.other++;
      }
    });
    return counts;
  }, [accounts]);

  // Filter and sort accounts (pinned first, then alphabetical)
  const filteredAccounts = useMemo(() => {
    return accounts
      .filter((acc) => {
        const matchesCategory = activeCategory === 'all' || acc.category === activeCategory;
        const matchesSearch =
          acc.issuer.toLowerCase().includes(searchQuery.toLowerCase()) ||
          acc.accountName.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return a.issuer.localeCompare(b.issuer);
      });
  }, [accounts, activeCategory, searchQuery]);

  // Mandatory Authentication Screen if not logged in
  if (!userSession) {
    return (
      <>
        <AuthScreen onShowToast={showToast} />
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  if (isLocked) {
    return (
      <>
        <LockScreen onUnlock={() => setIsLocked(false)} onShowToast={showToast} />
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  return (
    <div className="app-layout">
      <Navbar
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLockVault={() => setIsLocked(true)}
        onSignOut={handleSignOut}
        hasPin={hasPin}
        userSession={userSession}
        isTelegram={isTelegram}
      />

      <main>
        <SearchAndFilter
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          categoryCounts={categoryCounts}
        />

        {filteredAccounts.length > 0 ? (
          <div className="accounts-grid">
            {filteredAccounts.map((account) => (
              <OtpCard
                key={account.id}
                account={account}
                onDelete={handleDeleteAccount}
                onTogglePin={handleTogglePin}
                onShowToast={showToast}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon-circle">
              {searchQuery ? <ShieldAlert size={24} /> : <Sparkles size={24} />}
            </div>
            <h3 className="empty-title">
              {searchQuery ? 'No matching accounts' : 'Vault is empty'}
            </h3>
            <p className="empty-desc">
              {searchQuery
                ? `No accounts matching "${searchQuery}".`
                : 'Add an account via camera QR scan, image upload, or manual secret.'}
            </p>
            {!searchQuery && (
              <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
                <Plus size={15} strokeWidth={2.5} />
                <span>Add Account</span>
              </button>
            )}
          </div>
        )}
      </main>

      <AddAccountModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddAccount={handleAddAccount}
        onShowToast={showToast}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        accounts={accounts}
        onImportAccounts={handleImportAccounts}
        hasPin={hasPin}
        onPinChange={handlePinChange}
        syncConfig={syncConfig}
        onSaveSyncConfig={handleSaveCloud}
        userSession={userSession}
        onShowToast={showToast}
        isTelegram={isTelegram}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(session) => setUserSession(session)}
        onShowToast={showToast}
      />

      <ToastContainer toasts={toasts} />
    </div>
  );
}

export default App;
