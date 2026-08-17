import React, { useState, useRef, useEffect } from 'react';
import { Moon, Sun, Sparkles } from 'lucide-react';
import { ThemeMode } from '../types/auth';

interface ThemeSwitcherProps {
  currentTheme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  currentTheme,
  onThemeChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const themes: { id: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { id: 'dark', label: 'Dark Espresso', icon: <Moon size={14} /> },
    { id: 'light', label: 'Light Cream', icon: <Sun size={14} /> },
    { id: 'midnight', label: 'Midnight Indigo', icon: <Sparkles size={14} /> }
  ];

  const currentIcon = () => {
    switch (currentTheme) {
      case 'light':
        return <Sun size={15} />;
      case 'midnight':
        return <Sparkles size={15} />;
      case 'dark':
      default:
        return <Moon size={15} />;
    }
  };

  return (
    <div className="theme-switcher-wrapper" ref={menuRef}>
      <button
        type="button"
        className="theme-switcher-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="Change Appearance Theme"
        aria-label="Change Theme"
      >
        {currentIcon()}
        <span className="theme-trigger-label">
          {currentTheme === 'dark' ? 'Dark' : currentTheme === 'light' ? 'Light' : 'Midnight'}
        </span>
      </button>

      {isOpen && (
        <div className="theme-dropdown-menu">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`theme-dropdown-item ${currentTheme === t.id ? 'active' : ''}`}
              onClick={() => {
                onThemeChange(t.id);
                setIsOpen(false);
              }}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
