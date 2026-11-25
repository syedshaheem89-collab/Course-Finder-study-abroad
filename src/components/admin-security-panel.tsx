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
  role: 'super_admin' | 'admin';
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

  // Create new admin form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'super_admin'>('admin');
  const [creatingUser, setCreatingUser] = useState(false);

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
      setNewRole('admin');
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
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Dedicated AUTH_SESSION_SECRET Recommended</p>
            <p className="text-[11px] opacity-90 mt-0.5">
              Set a separate 64-character hex <code>AUTH_SESSION_SECRET</code> in Vercel Environment Variables so session encryption is isolated from your Supabase service key.
            </p>
          </div>
        </div>
      )}

      {banner && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between gap-2 ${
            banner.type === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
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
        <div className="glass-card p-4 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>2FA Enforcement</span>
            <Smartphone className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-lg font-black text-slate-900 dark:text-white">Mandatory TOTP</p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
            Zero-bypass RFC 6238 Authenticator
          </p>
        </div>

        <div className="glass-card p-4 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Session Encryption</span>
            <Lock className="w-4 h-4 text-cyan-500" />
          </div>
          <p className="text-lg font-black text-slate-900 dark:text-white">AES-256-GCM</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            HttpOnly • SameSite=Strict • 30m idle
          </p>
        </div>

        <div className="glass-card p-4 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Active Admins</span>
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-lg font-black text-slate-900 dark:text-white">
            {activeCount} / {users.length}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Public signups locked
          </p>
        </div>

        <div className="glass-card p-4 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Security Alerts</span>
            <Activity className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-lg font-black text-slate-900 dark:text-white">
            {criticalCount} Critical
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {logs.length} total logged events
          </p>
        </div>
      </div>

      {/* Admin Accounts Manager */}
      <section className="glass-card rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-500" />
              Authorized Admin Accounts
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Only Super Admins can create, unlock, reset 2FA, or revoke other accounts.
            </p>
          </div>
          <button
            onClick={loadAll}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {currentRole === 'super_admin' && (
          <form
            onSubmit={handleCreateAdmin}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3"
          >
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-cyan-500" />
              Create New Admin / Staff Account
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Full Name"
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
              />
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="admin@domain.com"
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
              />
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Strong 12+ char password"
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
              />
              <div className="flex gap-2">
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'admin' | 'super_admin')}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl px-2.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 flex-1"
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="neon-btn-cyan px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer shrink-0 disabled:opacity-60"
                >
                  {creatingUser ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 text-[11px] uppercase text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-2">Admin User</th>
                <th className="py-2.5 px-2">Role</th>
                <th className="py-2.5 px-2">2FA Status</th>
                <th className="py-2.5 px-2">Last Login</th>
                <th className="py-2.5 px-2">State</th>
                {currentRole === 'super_admin' && <th className="py-2.5 px-2 text-right">Controls</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/5">
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                const busy = actionBusyId === u.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-white/5">
                    <td className="py-3 px-2">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{u.name}</span>
                        {isSelf && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-bold">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-3 px-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.role === 'super_admin'
                            ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                            : 'bg-slate-500/15 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {u.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      {u.totp_enabled ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          Active ({u.unused_backup_codes} backup left)
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          Pending Setup
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {u.last_login_at
                        ? `${new Date(u.last_login_at).toLocaleString()} (${u.last_login_ip || 'unknown'})`
                        : 'Never'}
                    </td>
                    <td className="py-3 px-2">
                      {u.status === 'disabled' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400">
                          Disabled
                        </span>
                      ) : u.is_locked ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          Locked ({u.failed_attempts} fails)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
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
                              className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Unlock className="w-3 h-3" /> Unlock
                            </button>
                          )}
                          <button
                            disabled={busy}
                            onClick={() => handleAccountAction(u.id, 'reset_mfa')}
                            className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold cursor-pointer"
                          >
                            Reset 2FA
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => handleAccountAction(u.id, 'revoke_sessions')}
                            className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-[10px] font-bold cursor-pointer"
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
                                className="px-2 py-1 rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Power className="w-3 h-3" />
                                {u.status === 'active' ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => handleDeleteUser(u.id, u.email)}
                                className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
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
        <form onSubmit={handleChangePassword} className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-cyan-500" />
              Change My Password
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Requires your current password and live 6-digit Authenticator code. Automatically revokes other devices.
            </p>
          </div>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current Password"
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
          />
          <input
            type="password"
            required
            value={nextPassword}
            onChange={(e) => setNextPassword(e.target.value)}
            placeholder="New Strong Password (12+ chars, upper, lower, number, symbol)"
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
          />
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            required
            value={pwTotp}
            onChange={(e) => setPwTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Live 6-Digit Authenticator Code"
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={changingPw}
            className="neon-btn-cyan px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {changingPw && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Update Password
          </button>
        </form>

        <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                Recovery Codes &amp; Global Sign Out
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Regenerate 8 emergency single-use backup codes or immediately sign out across all browsers.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOutAllDevices}
              className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
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
              className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={regenerating}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer disabled:opacity-60 shrink-0"
            >
              {regenerating ? 'Generating...' : 'Regenerate 8 Codes'}
            </button>
          </form>

          {freshCodes.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-800 dark:text-white">
                <span>New Recovery Codes (shown once)</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(freshCodes.join('\n')).catch(() => {});
                      setCopiedCodes(true);
                      setTimeout(() => setCopiedCodes(false), 2000);
                    }}
                    className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCodes ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
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
                    className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> .txt
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] text-cyan-700 dark:text-cyan-300">
                {freshCodes.map((c) => (
                  <div
                    key={c}
                    className="px-2 py-1 rounded bg-white dark:bg-slate-900 text-center border border-slate-200 dark:border-white/10"
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
      <section className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-500" />
              Live Security Audit Log (Last 100 Events)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Tracks logins, failed attempts, lockouts, SSRF blocks, account updates, and database writes.
            </p>
          </div>
          <button
            onClick={loadAll}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-semibold cursor-pointer"
          >
            Refresh Log
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-white dark:bg-[#0f1523]">
              <tr className="border-b border-slate-200 dark:border-white/10 text-[11px] uppercase text-slate-500">
                <th className="py-2 px-2">Time</th>
                <th className="py-2 px-2">Severity</th>
                <th className="py-2 px-2">Event</th>
                <th className="py-2 px-2">Actor</th>
                <th className="py-2 px-2">IP</th>
                <th className="py-2 px-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/5">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No security events logged yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-white/5">
                    <td className="py-2 px-2 text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.severity === 'CRITICAL'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            : log.severity === 'WARN'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                        }`}
                      >
                        {log.severity}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                      {log.event}
                    </td>
                    <td className="py-2 px-2 text-[11px] text-slate-600 dark:text-slate-300">
                      {log.actor_email || '—'}
                    </td>
                    <td className="py-2 px-2 font-mono text-[11px] text-slate-500">
                      {log.ip || '—'}
                    </td>
                    <td className="py-2 px-2 text-[11px] text-slate-500 max-w-xs truncate">
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
