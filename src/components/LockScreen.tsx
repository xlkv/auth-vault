import React, { useState } from 'react';
import { ShieldCheck, Delete } from 'lucide-react';
import { hashPin } from '../lib/crypto';
import { StorageService } from '../lib/storage';
import { triggerHaptic } from '../lib/telegram';

interface LockScreenProps {
  onUnlock: () => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock, onShowToast }) => {
  const [pin, setPin] = useState<string>('');
  const [isShaking, setIsShaking] = useState<boolean>(false);

  const handleKeyPress = async (num: string) => {
    if (pin.length >= 6) return;
    const nextPin = pin + num;
    setPin(nextPin);
    triggerHaptic('light');

    // Check if entered pin matches stored hash
    const storedHash = StorageService.getPinHash();
    if (storedHash) {
      const currentHash = await hashPin(nextPin);
      if (currentHash === storedHash) {
        triggerHaptic('success');
        onUnlock();
        return;
      }

      // If reached 6 digits or length of hash failed
      if (nextPin.length >= 6) {
        triggerHaptic('error');
        setIsShaking(true);
        onShowToast('Incorrect PIN', 'error');
        setTimeout(() => {
          setPin('');
          setIsShaking(false);
        }, 500);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    triggerHaptic('light');
  };

  const handleCheck = async () => {
    const storedHash = StorageService.getPinHash();
    if (!storedHash) {
      onUnlock();
      return;
    }
    const currentHash = await hashPin(pin);
    if (currentHash === storedHash) {
      triggerHaptic('success');
      onUnlock();
    } else {
      triggerHaptic('error');
      setIsShaking(true);
      onShowToast('Incorrect PIN', 'error');
      setTimeout(() => {
        setPin('');
        setIsShaking(false);
      }, 500);
    }
  };

  return (
    <div className="lock-screen-container">
      <div className={`lock-card ${isShaking ? 'shake' : ''}`}>
        <div className="brand-logo-icon" style={{ width: 48, height: 48, borderRadius: 14 }}>
          <ShieldCheck size={28} />
        </div>

        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            VaultAuth Locked
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Enter your PIN to view 2FA codes
          </p>
        </div>

        <div className="pin-dots">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`pin-dot ${pin.length > index ? 'filled' : ''}`}
            />
          ))}
        </div>

        <div className="pin-grid">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              className="pin-key-btn"
              onClick={() => handleKeyPress(digit)}
            >
              {digit}
            </button>
          ))}
          <button className="pin-key-btn" style={{ fontSize: '0.85rem' }} onClick={handleCheck}>
            OK
          </button>
          <button className="pin-key-btn" onClick={() => handleKeyPress('0')}>
            0
          </button>
          <button className="pin-key-btn" onClick={handleDelete} aria-label="Backspace">
            <Delete size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
