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
      'Course Engine Super Admin - Backup Recovery Codes',
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
    a.download = 'course-engine-superadmin-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#F5F5F7] dark:bg-black transition-colors">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2.5">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#1D1D1F] dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-[28px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-[-0.025em]">
            One-Time Super Admin Bootstrap
          </h1>
          <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6] max-w-md mx-auto">
            Creates your master administrator account &amp; pairs Google Authenticator 2FA. Locks permanently once completed.
          </p>
        </div>

        {statusLoading ? (
          <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-10 text-center text-[13px] text-[#6E6E73] dark:text-[#A1A1A6] border border-black/5 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#0071E3]" />
            Checking security status...
          </div>
        ) : initialized ? (
          <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-8 text-center space-y-3 border border-black/5 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
            <ShieldCheck className="w-10 h-10 text-[#1D7A39] dark:text-[#30D158] mx-auto" />
            <h2 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              Admin setup is permanently locked
            </h2>
            <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6]">
              A Super Admin account is already active. Redirecting to Admin Sign In...
            </p>
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium transition-colors"
            >
              Go to Admin Login
            </Link>
          </div>
        ) : !setupKeyConfigured ? (
          <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-7 space-y-4 border border-black/5 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
            <div className="flex items-start gap-2.5 text-[#0066CC] dark:text-[#2997FF]">
              <AlertTriangle className="w-5 h-5 shrink-0 text-[#0066CC] dark:text-[#2997FF] mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">Server Environment Keys Required First</h2>
                <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6]">
                  Add these two environment variables in your Vercel Project Settings (and local <code>.env.local</code>) and redeploy before creating the master account:
                </p>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/5 dark:border-white/10 font-mono text-[11px] space-y-1.5 overflow-x-auto">
              <div>ADMIN_SETUP_SECRET=&lt;your-secret-at-least-16-chars&gt;</div>
              <div>AUTH_SESSION_SECRET=&lt;64-character-random-hex-key&gt;</div>
            </div>
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#0071E3] hover:underline"
            >
              ← Back to Admin Login
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 sm:p-8 space-y-5 border border-black/5 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
            {!sessionSecretConfigured && (
              <div className="p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/[0.08] dark:border-white/10 text-[12px] text-[#1D1D1F] dark:text-[#F5F5F7] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#0066CC] dark:text-[#2997FF]" />
                <span>
                  Tip: Set a dedicated <code>AUTH_SESSION_SECRET</code> (32+ chars) in Vercel for maximum key separation.
                </span>
              </div>
            )}

            {error && (
              <div className="p-3.5 rounded-2xl bg-[#FFEBE9] dark:bg-[#FF453A]/15 border border-[#FF3B30]/20 text-[12px] text-[#C9211A] dark:text-[#FF6961] flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {step === 'form' ? (
              <form onSubmit={handleCreateAdmin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#A1A1A6] block">
                    Setup Secret Key (ADMIN_SETUP_SECRET)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[#8E8E93] absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      required
                      value={setupSecret}
                      onChange={(e) => setSetupSecret(e.target.value)}
                      placeholder="Paste your ADMIN_SETUP_SECRET"
                      className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] rounded-xl pl-10 pr-3.5 py-2.5 text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#A1A1A6] block">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#8E8E93] absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Syed Admin"
                        className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] rounded-xl pl-10 pr-3.5 py-2.5 text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#A1A1A6] block">
                      Super Admin Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#8E8E93] absolute left-3.5 top-3.5" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@domain.com"
                        className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] rounded-xl pl-10 pr-3.5 py-2.5 text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#A1A1A6] block">
                    Strong Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#8E8E93] absolute left-3.5 top-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 12 characters"
                      className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] rounded-xl pl-10 pr-10 py-2.5 text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-3 text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[11px]">
                  {pwRules.map((rule) => (
                    <div
                      key={rule.label}
                      className={`flex items-center gap-1.5 ${
                        rule.ok
                          ? 'text-[#1D7A39] dark:text-[#30D158] font-semibold'
                          : 'text-[#6E6E73] dark:text-[#A1A1A6]'
                      }`}
                    >
                      {rule.ok ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
                      <span>{rule.label}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#A1A1A6] block">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter strong password"
                    className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] rounded-xl px-3.5 py-2.5 text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-colors"
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
                <div className="p-3.5 rounded-2xl bg-[#E8F8EE] dark:bg-[#30D158]/15 border border-[#34C759]/25 text-[12px] text-[#1D7A39] dark:text-[#30D158] flex items-center gap-2">
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>
                    Super Admin created! Scan the QR code with Google Authenticator to complete setup.
                  </span>
                </div>

                {qrDataUrl && (
                  <div className="flex flex-col items-center gap-2.5 bg-white p-4 rounded-2xl border border-black/10">
                    <img src={qrDataUrl} alt="2FA QR Code" className="w-44 h-44" />
                    <div className="w-full pt-2 border-t border-black/10 flex items-center justify-between gap-2 text-[11px] text-[#1D1D1F]">
                      <span className="font-mono truncate">{manualSecret}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(manualSecret).catch(() => {});
                          setCopiedSecret(true);
                          setTimeout(() => setCopiedSecret(false), 2000);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] font-medium shrink-0 cursor-pointer transition-colors"
                      >
                        {copiedSecret ? <Check className="w-3 h-3 text-[#1D7A39]" /> : <Copy className="w-3 h-3" />}
                        {copiedSecret ? 'Copied' : 'Copy Key'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/5 dark:border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
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
                        className="px-2.5 py-1 rounded-full bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                      >
                        {copiedCodes ? <Check className="w-3 h-3 text-[#1D7A39]" /> : <Copy className="w-3 h-3" />}
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={downloadCodes}
                        className="px-2.5 py-1 rounded-full bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        Save .txt
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {backupCodes.map((c) => (
                      <div
                        key={c}
                        className="px-2 py-1 rounded-lg bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 text-center"
                      >
                        {c}
                      </div>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-[12px] text-[#6E6E73] dark:text-[#A1A1A6] cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={savedCodesConfirmed}
                      onChange={(e) => setSavedCodesConfirmed(e.target.checked)}
                    />
                    <span>I have saved my recovery codes offline</span>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#A1A1A6] block">
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
                    className="w-full text-center tracking-[0.45em] font-mono text-xl font-semibold bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] rounded-xl px-4 py-3 text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-[14px] font-medium flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-colors"
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
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6E6E73] hover:text-[#0071E3] dark:text-[#A1A1A6] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Admin Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
