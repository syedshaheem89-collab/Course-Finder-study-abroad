'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  KeyRound,
  Smartphone,
  Copy,
  Check,
  Download,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [setupChecked, setSetupChecked] = useState(false);
  const [initialized, setInitialized] = useState(true);

  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [mfaMode, setMfaMode] = useState<'verify' | 'enroll'>('verify');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [manualSecret, setManualSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [savedCodesConfirmed, setSavedCodesConfirmed] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  const [totpCode, setTotpCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/setup-status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.initialized === 'boolean') {
          setInitialized(d.initialized);
        }
      })
      .catch(() => {})
      .finally(() => setSetupChecked(true));

    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.authenticated) {
          router.replace('/admin');
        }
      })
      .catch(() => {});
  }, [router]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Authentication failed.');
        return;
      }

      if (data.mode === 'enroll') {
        setMfaMode('enroll');
        setQrDataUrl(data.qrDataUrl || '');
        setManualSecret(data.manualSecret || '');
        setBackupCodes(Array.isArray(data.backupCodes) ? data.backupCodes : []);
        setSavedCodesConfirmed(false);
      } else {
        setMfaMode('verify');
      }
      setTotpCode('');
      setRecoveryCode('');
      setUseRecovery(false);
      setStep('mfa');
    } catch {
      setError('Network error during sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaMode === 'enroll' && !savedCodesConfirmed) {
      setError('Please confirm that you have saved your 8 backup recovery codes first.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          useRecovery && mfaMode === 'verify'
            ? { recoveryCode: recoveryCode.trim() }
            : { code: totpCode.trim() }
        ),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Verification failed.');
        return;
      }

      router.replace('/admin');
      router.refresh();
    } catch {
      setError('Network error verifying 2FA code.');
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string, which: 'secret' | 'codes') => {
    navigator.clipboard?.writeText(text).catch(() => {});
    if (which === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  };

  const downloadBackupCodes = () => {
    const content = [
      'GlobalCourse AI Admin - 2FA Backup Recovery Codes',
      `Account: ${email}`,
      `Generated: ${new Date().toISOString()}`,
      'Keep these offline in a safe place. Each code can be used ONCE.',
      '',
      ...backupCodes,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `globalcourse-admin-recovery-codes.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-slate-50 dark:bg-[#07090e]">
      <div className="w-full max-w-md space-y-5">
        {/* Vault Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 via-sky-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Admin Security Vault
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Protected by Encrypted Sessions, Brute-Force Lockout &amp; Mandatory 2FA
          </p>
        </div>

        {/* Initial Setup Prompt */}
        {setupChecked && !initialized && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 space-y-2.5 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">No Super Admin account configured yet</p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  Complete the one-time setup with your secret setup key to create your locked Super Admin account and pair Google Authenticator.
                </p>
              </div>
            </div>
            <Link
              href="/admin/setup"
              className="neon-btn-cyan w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Create Super Admin Account (One-Time Setup)
            </Link>
          </div>
        )}

        {/* Main Card */}
        <div className="glass-card rounded-3xl p-6 sm:p-7 space-y-5 border border-slate-200/80 dark:border-white/10">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {step === 'credentials' ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@yourdomain.com"
                    className="w-full bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-white/15 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your strong password"
                    className="w-full bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-white/15 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="neon-btn-cyan w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying Credentials...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Continue to 2FA Verification
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              {mfaMode === 'enroll' ? (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-xs text-cyan-800 dark:text-cyan-200">
                    <p className="font-bold flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-cyan-500" />
                      Mandatory Authenticator Setup
                    </p>
                    <p className="text-[11px] opacity-90 mt-1">
                      Scan this QR code in Google Authenticator, 1Password, or Authy, save your recovery codes, then enter the 6-digit code below.
                    </p>
                  </div>

                  {qrDataUrl && (
                    <div className="flex flex-col items-center gap-2.5 bg-white p-4 rounded-2xl border border-slate-200">
                      <img
                        src={qrDataUrl}
                        alt="2FA Authenticator QR Code"
                        className="w-44 h-44"
                      />
                      <div className="w-full pt-2 border-t border-slate-200 flex items-center justify-between gap-2 text-[11px] text-slate-700">
                        <span className="font-mono truncate">{manualSecret}</span>
                        <button
                          type="button"
                          onClick={() => copyText(manualSecret, 'secret')}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold shrink-0 cursor-pointer"
                        >
                          {copiedSecret ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          {copiedSecret ? 'Copied' : 'Copy Key'}
                        </button>
                      </div>
                    </div>
                  )}

                  {backupCodes.length > 0 && (
                    <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-800 dark:text-white">
                          One-Time Backup Recovery Codes (8)
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => copyText(backupCodes.join('\n'), 'codes')}
                            className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            {copiedCodes ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={downloadBackupCodes}
                            className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            Save .txt
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] text-slate-700 dark:text-cyan-300">
                        {backupCodes.map((c) => (
                          <div
                            key={c}
                            className="px-2 py-1 rounded-md bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 text-center"
                          >
                            {c}
                          </div>
                        ))}
                      </div>
                      <label className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={savedCodesConfirmed}
                          onChange={(e) => setSavedCodesConfirmed(e.target.checked)}
                          className="rounded border-slate-400"
                        />
                        <span>I have saved my recovery codes offline</span>
                      </label>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-800 dark:text-cyan-200 flex items-center gap-2.5">
                  <Smartphone className="w-4 h-4 text-cyan-500 shrink-0" />
                  <div>
                    <p className="font-bold">Two-Factor Authentication Required</p>
                    <p className="text-[11px] opacity-90">
                      Signed in as <span className="font-semibold">{email}</span>
                    </p>
                  </div>
                </div>
              )}

              {!useRecovery || mfaMode === 'enroll' ? (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    6-Digit Authenticator Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    autoFocus
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full text-center tracking-[0.45em] font-mono text-xl font-bold bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-white/15 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Backup Recovery Code
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                    placeholder="XXXX-XXXX-XXXX"
                    className="w-full text-center tracking-widest font-mono text-base font-bold bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-white/15 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="neon-btn-emerald w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying 2FA...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Unlock Admin Portal
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setError(null);
                  }}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                >
                  ← Use different account
                </button>
                {mfaMode === 'verify' && (
                  <button
                    type="button"
                    onClick={() => {
                      setUseRecovery((v) => !v);
                      setError(null);
                    }}
                    className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline cursor-pointer"
                  >
                    {useRecovery ? 'Use Authenticator Code' : 'Use Backup Recovery Code'}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Footer link */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Course Finder Website
          </Link>
        </div>
      </div>
    </div>
  );
}
