'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ShieldAlert,
  ArrowRight,
  ChevronLeft,
} from 'lucide-react';

export default function CounselorLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.isStaff) {
          window.location.href = '/courses';
        }
      })
      .catch(() => {})
      .finally(() => setCheckingSession(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/counselor-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Invalid credentials or account disabled.');
        return;
      }

      window.location.href = data.redirectTo || '/courses';
    } catch {
      setErrorMsg('Network error signing in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4">
        <div className="flex items-center gap-2 text-[13px] text-[#6E6E73] dark:text-[#A1A1A6]">
          <Loader2 className="w-4 h-4 animate-spin text-[#0071E3]" />
          <span>Checking staff session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-[#F5F5F7] dark:bg-black transition-colors">
      <div className="w-full max-w-md space-y-5">
        <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/10 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-none p-7 sm:p-9 space-y-6">
          <div className="text-center space-y-2.5">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-[#1D1D1F] dark:bg-[#2C2C2E] flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7]">
              Counselor Team Sign In
            </h1>
            <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6] leading-relaxed">
              Sign in with your team account for instant access to course details, AI eligibility checks, and Excel exports without lead pop-ups or affecting public analytics.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-[#FFEBE9] dark:bg-[#FF453A]/15 border border-[#FF3B30]/20 text-[12px] text-[#C9211A] dark:text-[#FF6961] flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#86868B] absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="counselor@youragency.com"
                  className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] rounded-xl pl-10 pr-3.5 py-2.5 text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#86868B] focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] block">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#86868B] absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] rounded-xl pl-10 pr-10 py-2.5 text-[14px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder-[#86868B] focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-3 text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] dark:bg-[#2997FF] text-white text-[14px] font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  <span>Sign In to Course Finder</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="text-center">
          <Link
            href="/courses"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#0071E3] transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Course Finder
          </Link>
        </div>
      </div>
    </div>
  );
}
