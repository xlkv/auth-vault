import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Image as ImageIcon, KeyRound, AlertCircle } from 'lucide-react';
import jsQR from 'jsqr';
import { TotpAccount, OtpAlgorithm, AccountCategory } from '../types/auth';
import { parseOtpAuthUri, parseRawInput } from '../lib/parser';
import { triggerHaptic } from '../lib/telegram';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAccount: (account: TotpAccount) => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  isOpen,
  onClose,
  onAddAccount,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'manual'>('camera');
  
  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Manual form state
  const [issuer, setIssuer] = useState('');
  const [accountName, setAccountName] = useState('');
  const [secret, setSecret] = useState('');
  const [category, setCategory] = useState<AccountCategory>('personal');
  const [algorithm, setAlgorithm] = useState<OtpAlgorithm>('SHA1');
  const [digits, setDigits] = useState<number>(6);
  const [period, setPeriod] = useState<number>(30);
  const [quickPaste, setQuickPaste] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Start / Stop camera scanner
  useEffect(() => {
    if (!isOpen || activeTab !== 'camera') {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        requestAnimationFrame(tickScan);
      }
    } catch (err) {
      console.error(err);
      setCameraError('Camera access was denied or not available on this device. Please use Image Upload or Manual Entry.');
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const tickScan = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (qrCode && qrCode.data) {
          handleQrResult(qrCode.data);
          return;
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(tickScan);
  };

  const handleQrResult = (data: string) => {
    try {
      const parsed = parseOtpAuthUri(data);
      if (parsed.secret && parsed.issuer) {
        onAddAccount(parsed as TotpAccount);
        triggerHaptic('success');
        onShowToast(`Successfully added ${parsed.issuer}!`, 'success');
        onClose();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid QR code';
      setErrorMsg(message);
    }
  };

  // Image file drop/upload handler
  const handleImageFile = (file: File) => {
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
          if (qrCode && qrCode.data) {
            handleQrResult(qrCode.data);
          } else {
            setErrorMsg('No QR code detected in this image. Please try another image or manual entry.');
          }
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Quick paste otpauth:// handler
  const handleQuickPasteChange = (text: string) => {
    setQuickPaste(text);
    setErrorMsg(null);
    if (text.trim().startsWith('otpauth://')) {
      try {
        const parsed = parseOtpAuthUri(text.trim());
        if (parsed.issuer) setIssuer(parsed.issuer);
        if (parsed.accountName) setAccountName(parsed.accountName);
        if (parsed.secret) setSecret(parsed.secret);
        if (parsed.algorithm) setAlgorithm(parsed.algorithm);
        if (parsed.digits) setDigits(parsed.digits);
        if (parsed.period) setPeriod(parsed.period);
        onShowToast('Parsed details from link!', 'info');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Invalid URI';
        setErrorMsg(message);
      }
    }
  };

  // Manual submit handler
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      if (!secret.trim()) {
        setErrorMsg('Please provide a secret key or otpauth:// link');
        return;
      }

      // If user pasted raw URI into secret or quickPaste
      let finalSecret = secret.trim().replace(/[\s-]/g, '').toUpperCase();
      let finalIssuer = issuer.trim() || 'Custom';
      let finalAccount = accountName.trim() || 'Account';

      if (secret.startsWith('otpauth://')) {
        const parsed = parseOtpAuthUri(secret);
        finalSecret = parsed.secret || finalSecret;
        finalIssuer = parsed.issuer || finalIssuer;
        finalAccount = parsed.accountName || finalAccount;
      } else {
        // Validate secret by parsing
        parseRawInput(finalSecret);
      }

      const newAccount: TotpAccount = {
        id: crypto.randomUUID(),
        issuer: finalIssuer,
        accountName: finalAccount,
        secret: finalSecret,
        algorithm,
        digits,
        period,
        category: category === 'all' ? 'personal' : category,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      onAddAccount(newAccount);
      triggerHaptic('success');
      onShowToast(`Added ${newAccount.issuer} to vault!`, 'success');
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid parameters';
      setErrorMsg(message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add New 2FA Account</h2>
          <button className="btn-icon-only" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-tabs">
            <button
              className={`modal-tab-btn ${activeTab === 'camera' ? 'active' : ''}`}
              onClick={() => setActiveTab('camera')}
            >
              <Camera size={16} /> Scan Camera
            </button>
            <button
              className={`modal-tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              <ImageIcon size={16} /> Upload Image
            </button>
            <button
              className={`modal-tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
              onClick={() => setActiveTab('manual')}
            >
              <KeyRound size={16} /> Manual Key
            </button>
          </div>

          {errorMsg && (
            <div
              style={{
                background: 'var(--accent-rose-subtle)',
                border: '1px solid var(--accent-rose)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                color: 'var(--accent-rose)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'camera' && (
            <div>
              {cameraError ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                  <p>{cameraError}</p>
                  <button
                    className="btn btn-secondary"
                    style={{ marginTop: '1rem' }}
                    onClick={() => setActiveTab('upload')}
                  >
                    Switch to Upload Screenshot
                  </button>
                </div>
              ) : (
                <div className="scanner-container">
                  <video ref={videoRef} className="scanner-video" />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  <div className="scanner-overlay-box">
                    <div className="scanner-scan-line" />
                  </div>
                </div>
              )}
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.75rem' }}>
                Point camera at Google Authenticator QR code on your screen
              </p>
            </div>
          )}

          {activeTab === 'upload' && (
            <div>
              <label
                className="dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleImageFile(e.dataTransfer.files[0]);
                }}
              >
                <ImageIcon size={32} style={{ color: 'var(--accent-emerald)' }} />
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Drop QR code screenshot here</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    or click to browse from device
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleImageFile(e.target.files[0]);
                  }}
                />
              </label>
            </div>
          )}

          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Paste otpauth:// link (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="otpauth://totp/GitHub:user?secret=JBSWY3DPEHPK3PXP..."
                  value={quickPaste}
                  onChange={(e) => handleQuickPasteChange(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Service / Issuer *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. GitHub, Google, Binance"
                    value={issuer}
                    onChange={(e) => setIssuer(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Account Name / Email</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. user@gmail.com"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Secret Key (Base32) *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. JBSWY3DPEHPK3PXP"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AccountCategory)}
                  >
                    <option value="personal">Personal</option>
                    <option value="work">Work</option>
                    <option value="finance">Finance & Crypto</option>
                    <option value="social">Social</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Algorithm</label>
                  <select
                    className="form-select"
                    value={algorithm}
                    onChange={(e) => setAlgorithm(e.target.value as OtpAlgorithm)}
                  >
                    <option value="SHA1">SHA-1 (Standard)</option>
                    <option value="SHA256">SHA-256</option>
                    <option value="SHA512">SHA-512</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Digits</label>
                  <select
                    className="form-select"
                    value={digits}
                    onChange={(e) => setDigits(parseInt(e.target.value, 10))}
                  >
                    <option value={6}>6 Digits</option>
                    <option value={8}>8 Digits</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Period (Seconds)</label>
                  <select
                    className="form-select"
                    value={period}
                    onChange={(e) => setPeriod(parseInt(e.target.value, 10))}
                  >
                    <option value={30}>30 Seconds (Default)</option>
                    <option value={60}>60 Seconds</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                Save Account to Vault
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
