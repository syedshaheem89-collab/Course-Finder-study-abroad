'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  Lock,
  Unlock,
  KeyRound,
  RefreshCw,
  Trash2,
  Power,
  LogOut,
  Copy,
  Check,
  Download,
  Loader2,
  AlertTriangle,
  Activity,
  Smartphone,
} from 'lucide-react';

interface AdminAccount {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'counselor';
  status: 'active' | 'disabled';
  totp_enabled: boolean;
  failed_attempts: number;
  locked_until: string | null;
  is_locked: boolean;
  last_login_at: string | null;
  last_login_ip: string | null;
  session_version: number;
  unused_backup_codes: number;
  created_at: string;
}

interface SecurityLogItem {
  id: string;
  event: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  actor_email: string | null;
  ip: string | null;
  path: string | null;
  details: Record<string, any>;
  created_at: string;
}

export default function AdminSecurityPanel() {
  const [users, setUsers] = useState<AdminAccount[]>([]);
  const [logs, setLogs] = useState<SecurityLogItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentRole, setCurrentRole] = useState<'super_admin' | 'admin'>('admin');
  const [securityStatus, setSecurityStatus] = useState({
    hasCustomSessionSecret: true,
    hasSetupSecret: true,
    mfaEnforced: true,
  });
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Create new admin / counselor form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'counselor' | 'admin' | 'super_admin'>('counselor');
  const [creatingUser, setCreatingUser] = useState(false);
  const [copiedCounselorLink, setCopiedCounselorLink] = useState(false);

  // Change password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [pwTotp, setPwTotp] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  // Regenerate recovery codes form
  const [regenTotp, setRegenTotp] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [freshCodes, setFreshCodes] = useState<string[]>([]);
  const [copiedCodes, setCopiedCodes] = useState(false);

  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, aRes] = await Promise.all([
        fetch('/api/auth/users', { cache: 'no-store' }),
        fetch('/api/auth/audit', { cache: 'no-store' }),
      ]);
      const uData = await uRes.json();
      const aData = await aRes.json();
      if (uData.success) {
        setUsers(uData.users || []);
        setCurrentUserId(uData.currentUserId || '');
        setCurrentRole(uData.currentRole || 'admin');
        if (uData.securityStatus) setSecurityStatus(uData.securityStatus);
      }
      if (aData.success) {
        setLogs(aData.logs || []);
      }
    } catch {
      setBanner({ type: 'err', text: 'Failed to load security telemetry.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setCreatingUser(true);
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setBanner({ type: 'err', text: data.error || 'Could not create admin account.' });
        return;
      }
      setBanner({ type: 'ok', text: data.message });
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('counselor');
      await loadAll();
    } catch {
      setBanner({ type: 'err', text: 'Network error creating account.' });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleAccountAction = async (
    id: string,
    action: 'unlock' | 'reset_mfa' | 'revoke_sessions' | 'disable' | 'enable'
  ) => {
    setBanner(null);
    setActionBusyId(id);
    try {
      const res = await fetch('/api/auth/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setBanner({ type: 'err', text: data.error || 'Action failed.' });
        return;
      }
      setBanner({ type: 'ok', text: data.message });
      await loadAll();
    } catch {
      setBanner({ type: 'err', text: 'Network error updating account.' });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (!window.confirm(`Permanently delete admin account ${email}? This cannot be undone.`)) {
      return;
    }
    setBanner(null);
    setActionBusyId(id);
    try {
      const res = await fetch(`/api/auth/users?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setBanner({ type: 'err', text: data.error || 'Delete failed.' });
        return;
      }
      setBanner({ type: 'ok', text: data.message });
      await loadAll();
    } catch {
      setBanner({ type: 'err', text: 'Network error deleting account.' });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setChangingPw(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword: nextPassword,
          totpCode: pwTotp,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setBanner({ type: 'err', text: data.error || 'Failed to update password.' });
        return;
      }
      setBanner({ type: 'ok', text: data.message });
      setCurrentPassword('');
      setNextPassword('');
      setPwTotp('');
      await loadAll();
    } catch {
      setBanner({ type: 'err', text: 'Network error changing password.' });
    } finally {
      setChangingPw(false);
    }
  };

  const handleRegenCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setRegenerating(true);
    try {
      const res = await fetch('/api/auth/backup-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totpCode: regenTotp }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setBanner({ type: 'err', text: data.error || 'Failed to regenerate backup codes.' });
        return;
      }
      setFreshCodes(data.backupCodes || []);
      setRegenTotp('');
      setBanner({ type: 'ok', text: data.message });
      await loadAll();
    } catch {
      setBanner({ type: 'err', text: 'Network error regenerating backup codes.' });
    } finally {
      setRegenerating(false);
    }
  };

  const handleSignOutAllDevices = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allDevices: true }),
    });
    window.location.href = '/admin/login';
  };

  const activeCount = users.filter((u) => u.status === 'active').length;
  const criticalCount = logs.filter((l) => l.severity === 'CRITICAL').length;

  return (
    <div className="space-y-6">
      {!securityStatus.hasCustomSessionSecret && (
        <div className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/[0.08] dark:border-white/10 text-[12px] text-[#1D1D1F] dark:text-[#F5F5F7] flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF] shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Dedicated AUTH_SESSION_SECRET Recommended</p>
            <p className="text-[11px] opacity-90 mt-0.5">
              Set a separate 64-character hex <code>AUTH_SESSION_SECRET</code> in Vercel Environment Variables so session encryption is isolated from your Supabase service key.
            </p>
          </div>
        </div>
      )}

      {banner && (
        <div
          className={`p-3.5 rounded-2xl border text-[13px] font-medium flex items-center justify-between gap-2 ${
            banner.type === 'ok'
              ? 'bg-[#E8F8EE] border-[#34C759]/25 text-[#1D7A39] dark:bg-[#30D158]/15 dark:text-[#30D158]'
              : 'bg-[#FFEBE9] border-[#FF3B30]/20 text-[#C9211A] dark:bg-[#FF453A]/15 dark:text-[#FF6961]'
          }`}
        >
          <span>{banner.text}</span>
          <button
            onClick={() => setBanner(null)}
            className="text-[11px] underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Security Wall Posture */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-2xl border border-black/5 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-1">
          <div className="flex items-center justify-between text-[12px] text-[#6E6E73] dark:text-[#A1A1A6] font-medium">
            <span>2FA Enforcement</span>
            <Smartphone className="w-4 h-4 text-[#1D7A39] dark:text-[#30D158]" />
          </div>
          <p className="text-[19px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">Mandatory TOTP</p>
          <p className="text-[11px] text-[#1D7A39] dark:text-[#30D158]">
            Zero-bypass RFC 6238 Authenticator
          </p>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-2xl border border-black/5 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-1">
          <div className="flex items-center justify-between text-[12px] text-[#6E6E73] dark:text-[#A1A1A6] font-medium">
            <span>Session Encryption</span>
            <Lock className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
          </div>
          <p className="text-[19px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">AES-256-GCM</p>
          <p className="text-[11px] text-[#6E6E73] dark:text-[#A1A1A6]">
            HttpOnly • SameSite=Strict • 30m idle
          </p>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-2xl border border-black/5 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-1">
          <div className="flex items-center justify-between text-[12px] text-[#6E6E73] dark:text-[#A1A1A6] font-medium">
            <span>Active Admins</span>
            <ShieldCheck className="w-4 h-4 text-[#1D1D1F] dark:text-[#F5F5F7]" />
          </div>
          <p className="text-[19px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {activeCount} / {users.length}
          </p>
          <p className="text-[11px] text-[#6E6E73] dark:text-[#A1A1A6]">
            Public signups locked
          </p>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-2xl border border-black/5 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-1">
          <div className="flex items-center justify-between text-[12px] text-[#6E6E73] dark:text-[#A1A1A6] font-medium">
            <span>Security Alerts</span>
            <Activity className="w-4 h-4 text-[#6E6E73] dark:text-[#A1A1A6]" />
          </div>
          <p className="text-[19px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {criticalCount} Critical
          </p>
          <p className="text-[11px] text-[#6E6E73] dark:text-[#A1A1A6]">
            {logs.length} total logged events
          </p>
        </div>
      </div>

      {/* Admin Accounts Manager */}
      <section className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
              Authorized Admin &amp; Counselor Accounts
            </h2>
            <p className="text-[13px] text-[#6E6E73] dark:text-[#A1A1A6]">
              Create team counselor logins (no pop-ups, no analytics skew) or admin accounts.
            </p>
          </div>
          <button
            onClick={loadAll}
            disabled={loading}
            className="px-4 py-1.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] border border-black/5 dark:border-white/10 text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Shareable Team Counselor Sign-In Link */}
        <div className="p-3.5 rounded-2xl bg-[#EAF3FF] dark:bg-[#2997FF]/10 border border-[#0071E3]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[12px]">
          <div className="space-y-0.5">
            <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] block">
              Team Counselor Sign-In Link
            </span>
            <span className="text-[#6E6E73] dark:text-[#A1A1A6]">
              Share <code className="font-mono text-[#0071E3] dark:text-[#2997FF]">/counselor/login</code> with your team so they bypass student pop-ups without Admin access.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const url =
                typeof window !== 'undefined'
                  ? `${window.location.origin}/counselor/login`
                  : '/counselor/login';
              navigator.clipboard?.writeText(url).catch(() => {});
              setCopiedCounselorLink(true);
              setTimeout(() => setCopiedCounselorLink(false), 2000);
            }}
            className="px-3.5 py-1.5 rounded-full bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/15 text-[12px] font-medium text-[#0071E3] dark:text-[#2997FF] inline-flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto"
          >
            {copiedCounselorLink ? <Check className="w-3.5 h-3.5 text-[#1D7A39]" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedCounselorLink ? 'Link Copied' : 'Copy Counselor Link'}
          </button>
        </div>

        {currentRole === 'super_admin' && (
          <form
            onSubmit={handleCreateAdmin}
            className="p-4 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E]/60 border border-black/5 dark:border-white/10 space-y-3"
          >
            <h3 className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#2997FF]" />
              Create New Counselor / Admin Account
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Full Name"
                className="bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/15 rounded-xl px-3.5 py-2 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:border-[#0071E3]"
              />
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="staff@youragency.com"
                className="bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/15 rounded-xl px-3.5 py-2 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:border-[#0071E3]"
              />
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Strong 12+ char password"
                className="bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/15 rounded-xl px-3.5 py-2 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:border-[#0071E3]"
              />
              <div className="flex gap-2">
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'counselor' | 'admin' | 'super_admin')}
                  className="bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/15 rounded-xl px-3 py-2 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:border-[#0071E3] flex-1"
                >
                  <option value="counselor">Counselor (Course Finder Only)</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-4 py-2 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-[12px] font-medium cursor-pointer shrink-0 disabled:opacity-60 transition-colors"
                >
                  {creatingUser ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-black/8 dark:border-white/10 text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#A1A1A6]">
                <th className="py-2.5 px-2">Admin User</th>
                <th className="py-2.5 px-2">Role</th>
                <th className="py-2.5 px-2">2FA Status</th>
                <th className="py-2.5 px-2">Last Login</th>
                <th className="py-2.5 px-2">State</th>
                {currentRole === 'super_admin' && <th className="py-2.5 px-2 text-right">Controls</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                const busy = actionBusyId === u.id;
                return (
                  <tr key={u.id} className="hover:bg-[#F5F5F7]/70 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 px-2">
                      <div className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5">
                        <span>{u.name}</span>
                        {isSelf && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] dark:text-[#2997FF] font-medium">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#6E6E73] dark:text-[#A1A1A6]">{u.email}</div>
                    </td>
                    <td className="py-3 px-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                          u.role === 'super_admin'
                            ? 'bg-[#1D1D1F] text-white dark:bg-white dark:text-[#1D1D1F]'
                            : u.role === 'counselor'
                            ? 'bg-[#EAF3FF] text-[#0071E3] dark:bg-[#2997FF]/15 dark:text-[#2997FF]'
                            : 'bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#A1A1A6]'
                        }`}
                      >
                        {u.role === 'super_admin'
                          ? 'Super Admin'
                          : u.role === 'counselor'
                          ? 'Counselor'
                          : 'Admin'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-[12px]">
                      {u.role === 'counselor' ? (
                        <span className="text-[#0071E3] dark:text-[#2997FF] font-medium">
                          Password Login (Course Finder)
                        </span>
                      ) : u.totp_enabled ? (
                        <span className="text-[#1D7A39] dark:text-[#30D158] font-medium">
                          Active ({u.unused_backup_codes} backup left)
                        </span>
                      ) : (
                        <span className="text-[#0066CC] dark:text-[#2997FF] font-medium">
                          Pending Setup
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-[11px] text-[#6E6E73] dark:text-[#A1A1A6]">
                      {u.last_login_at
                        ? `${new Date(u.last_login_at).toLocaleString()} (${u.last_login_ip || 'unknown'})`
                        : 'Never'}
                    </td>
                    <td className="py-3 px-2">
                      {u.status === 'disabled' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FFEBE9] text-[#C9211A] dark:bg-[#FF453A]/15 dark:text-[#FF6961]">
                          Disabled
                        </span>
                      ) : u.is_locked ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FFEBE9] text-[#C9211A] dark:bg-[#FF453A]/15 dark:text-[#FF6961]">
                          Locked ({u.failed_attempts} fails)
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#E8F8EE] text-[#1D7A39] dark:bg-[#30D158]/15 dark:text-[#30D158]">
                          Active
                        </span>
                      )}
                    </td>
                    {currentRole === 'super_admin' && (
                      <td className="py-3 px-2">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {(u.is_locked || u.failed_attempts > 0) && (
                            <button
                              disabled={busy}
                              onClick={() => handleAccountAction(u.id, 'unlock')}
                              className="px-2.5 py-1 rounded-full bg-[#E8F8EE] text-[#1D7A39] dark:bg-[#30D158]/15 dark:text-[#30D158] text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                            >
                              <Unlock className="w-3 h-3" /> Unlock
                            </button>
                          )}
                          {u.role !== 'counselor' && (
                            <button
                              disabled={busy}
                              onClick={() => handleAccountAction(u.id, 'reset_mfa')}
                              className="px-2.5 py-1 rounded-full bg-[#0071E3]/10 text-[#0066CC] dark:bg-[#2997FF]/15 dark:text-[#2997FF] text-[11px] font-medium cursor-pointer"
                            >
                              Reset 2FA
                            </button>
                          )}
                          <button
                            disabled={busy}
                            onClick={() => handleAccountAction(u.id, 'revoke_sessions')}
                            className="px-2.5 py-1 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] text-[11px] font-medium cursor-pointer"
                          >
                            Revoke Sessions
                          </button>
                          {!isSelf && (
                            <>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  handleAccountAction(u.id, u.status === 'active' ? 'disable' : 'enable')
                                }
                                className="px-2.5 py-1 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                              >
                                <Power className="w-3 h-3" />
                                {u.status === 'active' ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => handleDeleteUser(u.id, u.email)}
                                className="px-2.5 py-1 rounded-full bg-[#FFEBE9] text-[#C9211A] dark:bg-[#FF453A]/15 dark:text-[#FF6961] text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* My Account Security */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleChangePassword} className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
              Change My Password
            </h3>
            <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6]">
              Requires your current password and live 6-digit Authenticator code. Automatically revokes other devices.
            </p>
          </div>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current Password"
            className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] rounded-xl px-3.5 py-2.5 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none transition-colors"
          />
          <input
            type="password"
            required
            value={nextPassword}
            onChange={(e) => setNextPassword(e.target.value)}
            placeholder="New Strong Password (12+ chars, upper, lower, number, symbol)"
            className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] rounded-xl px-3.5 py-2.5 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none transition-colors"
          />
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            required
            value={pwTotp}
            onChange={(e) => setPwTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Live 6-Digit Authenticator Code"
            className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] rounded-xl px-3.5 py-2.5 text-[13px] font-mono text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={changingPw}
            className="px-5 py-2 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-60 transition-colors"
          >
            {changingPw && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Update Password
          </button>
        </form>

        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
                Recovery Codes &amp; Global Sign Out
              </h3>
              <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6]">
                Regenerate 8 emergency single-use backup codes or immediately sign out across all browsers.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOutAllDevices}
              className="px-3.5 py-1.5 rounded-full bg-[#FFEBE9] hover:bg-[#FFD8D4] text-[#C9211A] dark:bg-[#FF453A]/15 dark:text-[#FF6961] text-[12px] font-medium flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out All Devices
            </button>
          </div>

          <form onSubmit={handleRegenCodes} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={regenTotp}
              onChange={(e) => setRegenTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Live 6-Digit Authenticator Code"
              className="flex-1 bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-transparent focus:border-[#0071E3] focus:bg-white dark:focus:bg-[#1C1C1E] rounded-xl px-3.5 py-2.5 text-[13px] font-mono text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={regenerating}
              className="px-4 py-2 rounded-full bg-[#1D1D1F] hover:bg-black dark:bg-white dark:text-[#1D1D1F] text-white text-[13px] font-medium cursor-pointer disabled:opacity-60 shrink-0 transition-colors"
            >
              {regenerating ? 'Generating...' : 'Regenerate 8 Codes'}
            </button>
          </form>

          {freshCodes.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/5 dark:border-white/10 space-y-2">
              <div className="flex items-center justify-between text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                <span>New Recovery Codes (shown once)</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(freshCodes.join('\n')).catch(() => {});
                      setCopiedCodes(true);
                      setTimeout(() => setCopiedCodes(false), 2000);
                    }}
                    className="px-2.5 py-0.5 rounded-full bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCodes ? <Check className="w-3 h-3 text-[#1D7A39]" /> : <Copy className="w-3 h-3" />}
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob([freshCodes.join('\n')], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'backup-recovery-codes.txt';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-2.5 py-0.5 rounded-full bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> .txt
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] text-[#1D1D1F] dark:text-[#F5F5F7]">
                {freshCodes.map((c) => (
                  <div
                    key={c}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-[#1C1C1E] text-center border border-black/5 dark:border-white/10"
                  >
                    {c}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Security Audit Log */}
      <section className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#0071E3] dark:text-[#2997FF]" />
              Live Security Audit Log (Last 100 Events)
            </h3>
            <p className="text-[12px] text-[#6E6E73] dark:text-[#A1A1A6]">
              Tracks logins, failed attempts, lockouts, SSRF blocks, account updates, and database writes.
            </p>
          </div>
          <button
            onClick={loadAll}
            className="px-4 py-1.5 rounded-full bg-[#F5F5F7] dark:bg-[#2C2C2E] hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] border border-black/5 dark:border-white/10 text-[12px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] cursor-pointer transition-colors"
          >
            Refresh Log
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="sticky top-0 bg-white dark:bg-[#1C1C1E]">
              <tr className="border-b border-black/8 dark:border-white/10 text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#A1A1A6]">
                <th className="py-2 px-2">Time</th>
                <th className="py-2 px-2">Severity</th>
                <th className="py-2 px-2">Event</th>
                <th className="py-2 px-2">Actor</th>
                <th className="py-2 px-2">IP</th>
                <th className="py-2 px-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#6E6E73] dark:text-[#A1A1A6]">
                    No security events logged yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F5F5F7]/70 dark:hover:bg-white/5 transition-colors">
                    <td className="py-2 px-2 text-[11px] text-[#6E6E73] dark:text-[#A1A1A6] whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          log.severity === 'CRITICAL'
                            ? 'bg-[#FFEBE9] text-[#C9211A] dark:bg-[#FF453A]/15 dark:text-[#FF6961]'
                            : log.severity === 'WARN'
                            ? 'bg-[#0071E3]/10 text-[#0066CC] dark:bg-[#2997FF]/15 dark:text-[#2997FF]'
                            : 'bg-[#F5F5F7] text-[#1D1D1F] dark:bg-[#2C2C2E] dark:text-[#F5F5F7]'
                        }`}
                      >
                        {log.severity}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-mono text-[11px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {log.event}
                    </td>
                    <td className="py-2 px-2 text-[11px] text-[#6E6E73] dark:text-[#A1A1A6]">
                      {log.actor_email || '—'}
                    </td>
                    <td className="py-2 px-2 font-mono text-[11px] text-[#6E6E73] dark:text-[#A1A1A6]">
                      {log.ip || '—'}
                    </td>
                    <td className="py-2 px-2 text-[11px] text-[#6E6E73] dark:text-[#A1A1A6] max-w-xs truncate">
                      {log.details && Object.keys(log.details).length > 0
                        ? JSON.stringify(log.details)
                        : log.path || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
