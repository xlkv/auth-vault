import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Image as ImageIcon, KeyRound, AlertCircle, Monitor, Clipboard, CheckCircle2 } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'screen' | 'camera' | 'upload' | 'manual'>('screen');
  
  // Video / Scanner state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isScreenCapturing, setIsScreenCapturing] = useState(false);

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

  // Global Clipboard Paste (Cmd + V / Ctrl + V) listener
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.includes('image')) {
          const file = items[i].getAsFile();
          if (file) {
            onShowToast('Decoding QR code from clipboard...', 'info');
            handleImageFile(file);
            break;
          }
        } else if (items[i].type === 'text/plain') {
          items[i].getAsString((text) => {
            if (text.startsWith('otpauth://')) {
              handleQuickPasteChange(text);
              setActiveTab('manual');
            }
          });
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  // Start / Stop camera scanner
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    if (activeTab === 'camera') {
      startCamera();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen, activeTab]);

  const startCamera = async () => {
    setScannerError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
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
      setScannerError('Camera access was denied or not available. Use Screen Scanner or Screenshot Paste.');
    }
  };

  /**
   * Capture and Scan QR code directly from Desktop Screen / Window / Tab
   */
  const startScreenScan = async () => {
    setScannerError(null);
    setIsScreenCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'window'
        }
      });
      streamRef.current = stream;

      // Handle user stopping stream from browser UI
      stream.getVideoTracks()[0].onended = () => {
        setIsScreenCapturing(false);
        stopScanner();
      };

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        requestAnimationFrame(tickScan);
      }
    } catch (err) {
      console.error(err);
      setIsScreenCapturing(false);
      setScannerError('Screen capture cancelled or not supported by this browser.');
    }
  };

  const stopScanner = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScreenCapturing(false);
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
          stopScanner();
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
            setErrorMsg('No QR code detected in this image. Make sure the QR code is clear.');
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

      let finalSecret = secret.trim().replace(/[\s-]/g, '').toUpperCase();
      let finalIssuer = issuer.trim() || 'Custom';
      let finalAccount = accountName.trim() || 'Account';

      if (secret.startsWith('otpauth://')) {
        const parsed = parseOtpAuthUri(secret);
        finalSecret = parsed.secret || finalSecret;
        finalIssuer = parsed.issuer || finalIssuer;
        finalAccount = parsed.accountName || finalAccount;
      } else {
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
          <h2 className="modal-title">Add 2FA Account</h2>
          <button className="btn-icon-only" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Tabs */}
          <div className="modal-tabs">
            <button
              className={`modal-tab-btn ${activeTab === 'screen' ? 'active' : ''}`}
              onClick={() => { setActiveTab('screen'); stopScanner(); }}
            >
              <Monitor size={15} /> Scan Screen
            </button>
            <button
              className={`modal-tab-btn ${activeTab === 'camera' ? 'active' : ''}`}
              onClick={() => { setActiveTab('camera'); }}
            >
              <Camera size={15} /> Camera
            </button>
            <button
              className={`modal-tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => { setActiveTab('upload'); stopScanner(); }}
            >
              <ImageIcon size={15} /> Upload / Paste
            </button>
            <button
              className={`modal-tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
              onClick={() => { setActiveTab('manual'); stopScanner(); }}
            >
              <KeyRound size={15} /> Manual
            </button>
          </div>

          {errorMsg && (
            <div className="form-error-banner">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: DESKTOP SCREEN QR SCANNER */}
          {activeTab === 'screen' && (
            <div className="screen-scan-container">
              <div className="scanner-view-box">
                <video ref={videoRef} className="scanner-video" />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {isScreenCapturing ? (
                  <div className="scanner-overlay-target">
                    <div className="scanner-reticle" />
                    <div className="scanner-scan-bar" />
                    <span className="scanner-hint">Scanning desktop screen for QR code...</span>
                  </div>
                ) : (
                  <div className="screen-capture-placeholder">
                    <Monitor size={36} className="placeholder-icon" />
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '0.5rem' }}>
                      Scan QR Code on Your Desktop
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: 280, margin: '0.25rem auto 1rem' }}>
                      Click below, pick the window or tab containing the QR code, and we'll decode it instantly!
                    </p>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={startScreenScan}
                      style={{ padding: '0.6rem 1.25rem' }}
                    >
                      <Monitor size={16} />
                      <span>Select Screen / Window</span>
                    </button>
                  </div>
                )}
              </div>

              {scannerError && (
                <div className="form-error-banner" style={{ marginTop: '0.75rem' }}>
                  <AlertCircle size={16} />
                  <span>{scannerError}</span>
                </div>
              )}

              {/* Mac Screenshot tip */}
              <div className="clipboard-tip-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clipboard size={16} color="var(--accent-primary)" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Pro Tip: Clipboard Screenshot</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Press <kbd style={{ padding: '0.15rem 0.35rem', background: 'var(--bg-input)', borderRadius: 4, border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)' }}>Cmd + Ctrl + Shift + 4</kbd> on Mac (or PrintScreen on Windows) to capture the QR code, then just press <kbd style={{ padding: '0.15rem 0.35rem', background: 'var(--bg-input)', borderRadius: 4, border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)' }}>Cmd + V</kbd> here!
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: WEBCAM / CAMERA SCANNER */}
          {activeTab === 'camera' && (
            <div className="camera-scan-container">
              <div className="scanner-view-box">
                <video ref={videoRef} className="scanner-video" />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                <div className="scanner-overlay-target">
                  <div className="scanner-reticle" />
                  <div className="scanner-scan-bar" />
                  <span className="scanner-hint">Point camera at 2FA QR code</span>
                </div>
              </div>

              {scannerError && (
                <div className="form-error-banner" style={{ marginTop: '0.75rem' }}>
                  <AlertCircle size={16} />
                  <span>{scannerError}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: IMAGE DROP / CLIPBOARD PASTE */}
          {activeTab === 'upload' && (
            <div
              className="upload-dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleImageFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => {
                const input = document.getElementById('qr-file-input') as HTMLInputElement;
                if (input) input.click();
              }}
            >
              <input
                type="file"
                id="qr-file-input"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleImageFile(e.target.files[0]);
                  }
                }}
              />
              <ImageIcon size={32} style={{ color: 'var(--text-muted)' }} />
              <div style={{ marginTop: '0.5rem' }}>
                <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Drop QR code screenshot here</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  or click to select an image from your computer
                </p>
              </div>
              <div className="paste-pill">
                <Clipboard size={13} />
                <span>Supports direct <kbd style={{ fontFamily: 'var(--font-mono)' }}>Cmd + V</kbd> Paste</span>
              </div>
            </div>
          )}

          {/* TAB 4: MANUAL ENTRY FORM */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="manual-entry-form">
              <div className="form-group">
                <label className="form-label">Quick Import (otpauth:// URI)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="otpauth://totp/Google:user@gmail.com?secret=JBSWY3DPEHPK3PXP..."
                  value={quickPaste}
                  onChange={(e) => handleQuickPasteChange(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Issuer / Service Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. GitHub, Google, AWS"
                    value={issuer}
                    onChange={(e) => setIssuer(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Account / Email</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. user@example.com"
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
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AccountCategory)}
                  >
                    <option value="personal">Personal</option>
                    <option value="work">Work</option>
                    <option value="finance">Finance & Crypto</option>
                    <option value="social">Social Media</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group" style={{ width: 90 }}>
                  <label className="form-label">Digits</label>
                  <select
                    className="form-select"
                    value={digits}
                    onChange={(e) => setDigits(Number(e.target.value))}
                  >
                    <option value={6}>6 digits</option>
                    <option value={8}>8 digits</option>
                  </select>
                </div>

                <div className="form-group" style={{ width: 90 }}>
                  <label className="form-label">Period</label>
                  <select
                    className="form-select"
                    value={period}
                    onChange={(e) => setPeriod(Number(e.target.value))}
                  >
                    <option value={30}>30s</option>
                    <option value={60}>60s</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '0.75rem 0 0', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <CheckCircle2 size={16} />
                  <span>Save Account</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
