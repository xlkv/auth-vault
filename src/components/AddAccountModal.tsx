import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Image as ImageIcon, KeyRound, AlertCircle, Monitor, Clipboard, Check } from 'lucide-react';
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Preset services for 1-tap fill
  const popularServices = ['Google', 'GitHub', 'Telegram', 'Binance', 'Discord', 'AWS', 'OpenAI', 'Apple'];

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
            onShowToast('Scanning QR from clipboard image...', 'info');
            handleImageFile(file);
            break;
          }
        } else if (items[i].type === 'text/plain') {
          items[i].getAsString((text) => {
            if (text.startsWith('otpauth://')) {
              handleQuickPaste(text);
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
      setScannerError('Camera access was denied or not available. Use Screen Scan or Screenshot Paste.');
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
      setScannerError('Screen selection cancelled.');
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
        onShowToast(`Added ${parsed.issuer}!`, 'success');
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
            setErrorMsg('No QR code detected in image. Ensure QR code is clear.');
          }
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleQuickPaste = (text: string) => {
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
        setErrorMsg('Please enter a secret key or otpauth:// link');
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
      const message = err instanceof Error ? err.message : 'Invalid secret format';
      setErrorMsg(message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card snug-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Minimal Header */}
        <div className="modal-header-compact">
          <span className="modal-header-tag">Add Authenticator</span>
          <button type="button" className="modal-close-chip" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="modal-body-compact">
          {/* Seamless Apple-Style Segmented Control */}
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-tab ${activeTab === 'screen' ? 'active' : ''}`}
              onClick={() => { setActiveTab('screen'); stopScanner(); }}
            >
              <Monitor size={14} />
              <span>Screen</span>
            </button>
            <button
              type="button"
              className={`segmented-tab ${activeTab === 'camera' ? 'active' : ''}`}
              onClick={() => { setActiveTab('camera'); }}
            >
              <Camera size={14} />
              <span>Camera</span>
            </button>
            <button
              type="button"
              className={`segmented-tab ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => { setActiveTab('upload'); stopScanner(); }}
            >
              <ImageIcon size={14} />
              <span>Upload</span>
            </button>
            <button
              type="button"
              className={`segmented-tab ${activeTab === 'manual' ? 'active' : ''}`}
              onClick={() => { setActiveTab('manual'); stopScanner(); }}
            >
              <KeyRound size={14} />
              <span>Manual</span>
            </button>
          </div>

          {errorMsg && (
            <div className="modal-alert-error">
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: DESKTOP SCREEN QR SCANNER */}
          {activeTab === 'screen' && (
            <div className="tab-pane-content">
              {isScreenCapturing ? (
                <div className="viewfinder-box">
                  <video ref={videoRef} className="viewfinder-video" />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  <div className="viewfinder-overlay">
                    <div className="viewfinder-reticle" />
                    <div className="viewfinder-laser" />
                    <span className="viewfinder-hint">Scanning selected window...</span>
                  </div>
                </div>
              ) : (
                <div className="feature-action-card">
                  <div className="feature-icon-badge">
                    <Monitor size={22} />
                  </div>
                  <h4 className="feature-title">Scan Desktop Screen</h4>
                  <p className="feature-sub">
                    Pick any open window or browser tab showing the 2FA QR code to decode instantly.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-action-large"
                    onClick={startScreenScan}
                  >
                    <Monitor size={16} />
                    <span>Select Window / Screen</span>
                  </button>
                </div>
              )}

              {scannerError && (
                <div className="modal-alert-error" style={{ marginTop: '0.65rem' }}>
                  <AlertCircle size={15} />
                  <span>{scannerError}</span>
                </div>
              )}

              {/* Paste helper pill */}
              <div className="shortcut-tip-pill">
                <Clipboard size={13} />
                <span>
                  Or take a screenshot and press <kbd>Cmd + V</kbd> here
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: WEBCAM / CAMERA SCANNER */}
          {activeTab === 'camera' && (
            <div className="tab-pane-content">
              <div className="viewfinder-box">
                <video ref={videoRef} className="viewfinder-video" />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <div className="viewfinder-overlay">
                  <div className="viewfinder-reticle" />
                  <div className="viewfinder-laser" />
                  <span className="viewfinder-hint">Point camera at 2FA QR code</span>
                </div>
              </div>

              {scannerError && (
                <div className="modal-alert-error" style={{ marginTop: '0.65rem' }}>
                  <AlertCircle size={15} />
                  <span>{scannerError}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: IMAGE DROP / CLIPBOARD PASTE */}
          {activeTab === 'upload' && (
            <div className="tab-pane-content">
              <div
                className="upload-target-box"
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
                <div className="upload-icon-circle">
                  <ImageIcon size={22} />
                </div>
                <p className="upload-main-text">Drop QR image or click to browse</p>
                <p className="upload-sub-text">PNG, JPG, WEBP, or direct clipboard copy</p>
              </div>

              <div className="shortcut-tip-pill">
                <Clipboard size={13} />
                <span>
                  Press <kbd>Cmd + V</kbd> anywhere to paste QR image
                </span>
              </div>
            </div>
          )}

          {/* TAB 4: MANUAL ENTRY FORM */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="manual-clean-form">
              {/* Popular quick fill chips */}
              <div className="preset-chips-row">
                {popularServices.map((srv) => (
                  <button
                    key={srv}
                    type="button"
                    className={`preset-chip ${issuer.toLowerCase() === srv.toLowerCase() ? 'active' : ''}`}
                    onClick={() => setIssuer(srv)}
                  >
                    {srv}
                  </button>
                ))}
              </div>

              <div className="form-grid-2">
                <div className="input-field-group">
                  <label className="input-field-label">Service Name *</label>
                  <input
                    type="text"
                    className="pure-text-input"
                    placeholder="e.g. GitHub"
                    value={issuer}
                    onChange={(e) => setIssuer(e.target.value)}
                    required
                  />
                </div>
                <div className="input-field-group">
                  <label className="input-field-label">Account / Email</label>
                  <input
                    type="text"
                    className="pure-text-input"
                    placeholder="e.g. user@gmail.com"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                  />
                </div>
              </div>

              <div className="input-field-group">
                <label className="input-field-label">Secret Key (Base32) *</label>
                <input
                  type="text"
                  className="pure-text-input mono-font"
                  placeholder="e.g. JBSWY3DPEHPK3PXP"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  required
                />
              </div>

              <div className="form-grid-2">
                <div className="input-field-group">
                  <label className="input-field-label">Category</label>
                  <select
                    className="pure-select-input"
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

                <div className="input-field-group">
                  <label className="input-field-label">Period</label>
                  <select
                    className="pure-select-input"
                    value={period}
                    onChange={(e) => setPeriod(Number(e.target.value))}
                  >
                    <option value={30}>30 seconds (Standard)</option>
                    <option value={60}>60 seconds</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-submit-full">
                <Check size={16} strokeWidth={2.5} />
                <span>Save Authenticator</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
