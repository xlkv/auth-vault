import React from 'react';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

interface ToastContainerProps {
  toasts: ToastMessage[];
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === 'success' && <CheckCircle size={16} style={{ color: 'var(--accent-emerald)' }} />}
          {t.type === 'error' && <AlertCircle size={16} style={{ color: 'var(--accent-rose)' }} />}
          {t.type === 'info' && <Info size={16} style={{ color: 'var(--accent-blue)' }} />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
};
