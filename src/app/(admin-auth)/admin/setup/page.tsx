'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Check,
  X,
  Copy,
  Download,
  Smartphone,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  ShieldAlert,
} from 'lucide-react';

export default function AdminSetupPage() {
  const router = useRouter();
  const [statusLoading, setStatusLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [setupKeyConfigured, setSetupKeyConfigured] = useState(true);
  const [sessionSecretConfigured, setSessionSecretConfigured] = useState(true);

  const [step, setStep] = useState<'form' | 'enroll'>('form');
  const [setupSecret, setSetupSecret] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [qrDataUrl, setQrDataUrl] = useState('');
  const [manualSecret, setManualSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [savedCodesConfirmed, setSavedCodesConfirmed] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/setup-status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setInitialized(Boolean(d.initialized));
        setSetupKeyConfigured(d.setupKeyConfigured !== false);
        setSessionSecretConfigured(d.sessionSecretConfigured !== false);
        if (d.initialized) {
          setTimeout(() => router.replace('/admin/login'), 1800);
        }
      })
      .catch(() => {})
      .finally(() => setStatusLoading(false));
  }, [router]);

  const pwRules = [
    { label: 'At least 12 characters', ok: password.length >= 12 && password.length <= 128 },
    { label: 'Uppercase letter (A–Z)', ok: /[A-Z]/.test(password) },
    { label: 'Lowercase letter (a–z)', ok: /[a-z]/.test(password) },
    { label: 'Number (0–9)', ok: /[0-9]/.test(password) },
    { label: 'Special character (!@#$...)', ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const allPwRulesPass = pwRules.every((r) => r.ok);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!allPwRulesPass) {
      setError('Password must meet all 5 security requirements.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupSecret, name, email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Setup failed.');
        return;
      }

      setQrDataUrl(data.qrDataUrl || '');
      setManualSecret(data.manualSecret || '');
      setBackupCodes(Array.isArray(data.backupCodes) ? data.backupCodes : []);
      setStep('enroll');
    } catch {
      setError('Network error during setup.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedCodesConfirmed) {
      setError('Please check the box confirming you saved your 8 backup recovery codes.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || '2FA verification failed.');
        return;
      }
      router.replace('/admin');
      router.refresh();
    } catch {
      setError('Network error completing 2FA setup.');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadCodes = () => {
    const text = [
      'GlobalCourse AI Super Admin - Backup Recovery Codes',
      `Account: ${email}`,
      `Created: ${new Date().toISOString()}`,
      'Store offline safely. Each code works once if you lose your Authenticator device.',
      '',
      ...backupCodes,
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'globalcourse-superadmin-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-slate-50 dark:bg-[#07090e]">
      <div className="w-full max-w-lg space-y-5">
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            One-Time Super Admin Bootstrap
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Creates your master administrator account &amp; pairs Google Authenticator 2FA. Locks permanently once completed.
          </p>
        </div>

        {statusLoading ? (
          <div className="glass-card rounded-3xl p-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
            Checking security status...
          </div>
        ) : initialized ? (
          <div className="glass-card rounded-3xl p-8 text-center space-y-3 border border-emerald-500/30">
            <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Admin setup is permanently locked
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              A Super Admin account is already active. Redirecting to Admin Sign In...
            </p>
            <Link
              href="/admin/login"
              className="neon-btn-cyan inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold"
            >
              Go to Admin Login
            </Link>
          </div>
        ) : !setupKeyConfigured ? (
          <div className="glass-card rounded-3xl p-6 space-y-4 border border-amber-500/30">
            <div className="flex items-start gap-2.5 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-sm font-bold">Server Environment Keys Required First</h2>
                <p className="text-xs opacity-90">
                  Add these two environment variables in your Vercel Project Settings (and local <code>.env.local</code>) and redeploy before creating the master account:
                </p>
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900 text-slate-100 font-mono text-[11px] space-y-1.5 overflow-x-auto">
              <div>ADMIN_SETUP_SECRET=&lt;your-secret-at-least-16-chars&gt;</div>
              <div>AUTH_SESSION_SECRET=&lt;64-character-random-hex-key&gt;</div>
            </div>
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              ← Back to Admin Login
            </Link>
          </div>
        ) : (
          <div className="glass-card rounded-3xl p-6 sm:p-7 space-y-5 border border-slate-200/80 dark:border-white/10">
            {!sessionSecretConfigured && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                <span>
                  Tip: Set a dedicated <code>AUTH_SESSION_SECRET</code> (32+ chars) in Vercel for maximum key separation.
                </span>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {step === 'form' ? (
              <form onSubmit={handleCreateAdmin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Setup Secret Key (ADMIN_SETUP_SECRET)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      value={setupSecret}
                      onChange={(e) => setSetupSecret(e.target.value)}
                      placeholder="Paste your ADMIN_SETUP_SECRET"
                      className="w-full bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-white/15 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Syed Admin"
                        className="w-full bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-white/15 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Super Admin Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@domain.com"
                        className="w-full bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-white/15 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Strong Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 12 characters"
                      className="w-full bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-white/15 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-3 rounded-xl bg-slate-100/80 dark:bg-white/5 text-[11px]">
                  {pwRules.map((rule) => (
                    <div
                      key={rule.label}
                      className={`flex items-center gap-1.5 ${
                        rule.ok
                          ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {rule.ok ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
                      <span>{rule.label}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter strong password"
                    className="w-full bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="neon-btn-cyan w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Create Super Admin &amp; Generate 2FA QR
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyTotp} className="space-y-4">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>
                    Super Admin created! Scan the QR code with Google Authenticator to complete setup.
                  </span>
                </div>

                {qrDataUrl && (
                  <div className="flex flex-col items-center gap-2.5 bg-white p-4 rounded-2xl border border-slate-200">
                    <img src={qrDataUrl} alt="2FA QR Code" className="w-44 h-44" />
                    <div className="w-full pt-2 border-t border-slate-200 flex items-center justify-between gap-2 text-[11px] text-slate-700">
                      <span className="font-mono truncate">{manualSecret}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(manualSecret).catch(() => {});
                          setCopiedSecret(true);
                          setTimeout(() => setCopiedSecret(false), 2000);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 font-semibold shrink-0 cursor-pointer"
                      >
                        {copiedSecret ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        {copiedSecret ? 'Copied' : 'Copy Key'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-800 dark:text-white">
                      Save Your 8 Backup Recovery Codes
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(backupCodes.join('\n')).catch(() => {});
                          setCopiedCodes(true);
                          setTimeout(() => setCopiedCodes(false), 2000);
                        }}
                        className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedCodes ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={downloadCodes}
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
                    />
                    <span>I have saved my recovery codes offline</span>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Enter 6-Digit Authenticator Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full text-center tracking-[0.45em] font-mono text-xl font-bold bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-white/15 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="neon-btn-emerald w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Activating 2FA Vault...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Activate &amp; Enter Admin Portal
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        <div className="text-center">
          <Link
            href="/admin/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Admin Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
