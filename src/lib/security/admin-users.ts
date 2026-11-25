import { createClient, User } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase';
import { invalidateUserCache, PortalRole } from './session';

const globalForAdminState = globalThis as unknown as {
  __gcHasSuperAdmin?: boolean;
};

export function resetSuperAdminCache(): void {
  globalForAdminState.__gcHasSuperAdmin = undefined;
}

export async function listAdminUsers(): Promise<User[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (error || !data?.users) {
    throw new Error(error?.message || 'Failed to fetch admin accounts.');
  }

  return data.users.filter((u) => {
    const role = (u.app_metadata as any)?.role;
    return role === 'super_admin' || role === 'admin' || role === 'counselor';
  });
}

export async function hasAnySuperAdmin(): Promise<boolean> {
  if (globalForAdminState.__gcHasSuperAdmin === true) {
    return true;
  }

  try {
    const admins = await listAdminUsers();
    const exists = admins.some((u) => (u.app_metadata as any)?.role === 'super_admin');
    if (exists) {
      globalForAdminState.__gcHasSuperAdmin = true;
    }
    return exists;
  } catch {
    return false;
  }
}

export async function findAdminUserByEmail(email: string): Promise<User | null> {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return null;
  const accounts = await listAdminUsers();
  return (
    accounts.find((u) => {
      const role = (u.app_metadata as any)?.role;
      return (
        (role === 'super_admin' || role === 'admin') &&
        (u.email || '').trim().toLowerCase() === cleanEmail
      );
    }) || null
  );
}

export async function findPortalUserByEmail(email: string): Promise<User | null> {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return null;
  const accounts = await listAdminUsers();
  return accounts.find((u) => (u.email || '').trim().toLowerCase() === cleanEmail) || null;
}

/**
 * Verifies user email + password using a temporary non-persistent Supabase client.
 */
export async function verifySupabasePassword(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !anonKey || url.includes('placeholder')) {
    return false;
  }

  const ephemeral = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await ephemeral.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  return Boolean(!error && data?.user);
}

export function isAccountLocked(appMeta: Record<string, any> | undefined): {
  locked: boolean;
  until?: string;
} {
  if (!appMeta?.locked_until) return { locked: false };
  const lockedMs = new Date(appMeta.locked_until).getTime();
  if (Number.isNaN(lockedMs)) return { locked: false };
  if (Date.now() < lockedMs) {
    return { locked: true, until: appMeta.locked_until };
  }
  return { locked: false };
}

export async function recordFailedAttempt(
  user: User,
  ip: string
): Promise<{ lockedNow: boolean; failedCount: number; lockedUntil: string | null }> {
  const supabase = createServerSupabaseClient();
  const meta = (user.app_metadata || {}) as Record<string, any>;
  const failedCount = Number(meta.failed_attempts || 0) + 1;

  let lockMs = 0;
  if (failedCount >= 15) {
    lockMs = 24 * 60 * 60 * 1000; // 24 hours
  } else if (failedCount >= 10) {
    lockMs = 60 * 60 * 1000; // 60 minutes
  } else if (failedCount >= 5) {
    lockMs = 15 * 60 * 1000; // 15 minutes
  }

  const lockedUntil = lockMs > 0 ? new Date(Date.now() + lockMs).toISOString() : null;

  await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...meta,
      failed_attempts: failedCount,
      locked_until: lockedUntil,
      last_failed_ip: ip,
      last_failed_at: new Date().toISOString(),
    },
  });

  invalidateUserCache(user.id);
  return { lockedNow: Boolean(lockedUntil), failedCount, lockedUntil };
}

export async function recordSuccessfulLogin(
  user: User,
  ip: string,
  extraMeta?: Record<string, any>
): Promise<void> {
  const supabase = createServerSupabaseClient();
  const meta = (user.app_metadata || {}) as Record<string, any>;

  await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...meta,
      ...extraMeta,
      failed_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
      last_login_ip: ip,
    },
  });

  invalidateUserCache(user.id);
}

export function sanitizeAdminUser(user: User) {
  const meta = (user.app_metadata || {}) as Record<string, any>;
  const backupCodes = Array.isArray(meta.backup_codes) ? meta.backup_codes : [];
  const unusedBackupCount = backupCodes.filter((b: any) => !b?.used).length;
  const role: PortalRole =
    meta.role === 'super_admin'
      ? 'super_admin'
      : meta.role === 'counselor'
      ? 'counselor'
      : 'admin';

  return {
    id: user.id,
    email: user.email || '',
    name: String(meta.name || (role === 'counselor' ? 'Counselor' : 'Admin')),
    role,
    status: meta.status === 'disabled' ? 'disabled' : 'active',
    totp_enabled: meta.totp_enabled === true,
    failed_attempts: Number(meta.failed_attempts || 0),
    locked_until: meta.locked_until || null,
    is_locked: isAccountLocked(meta).locked,
    last_login_at: meta.last_login_at || null,
    last_login_ip: meta.last_login_ip || null,
    session_version: Number(meta.session_version || 1),
    unused_backup_codes: unusedBackupCount,
    created_at: user.created_at,
  };
}
