import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { hasDedicatedSessionSecret } from '@/lib/security/crypto';
import { validatePasswordStrength } from '@/lib/security/password';
import { isValidEmail, isValidUuid } from '@/lib/security/validation';
import { getClientIp } from '@/lib/security/rate-limit';
import {
  findPortalUserByEmail,
  listAdminUsers,
  sanitizeAdminUser,
} from '@/lib/security/admin-users';
import {
  invalidateUserCache,
  PortalRole,
  requireAdminSession,
} from '@/lib/security/session';
import { logSecurityEvent } from '@/lib/security/audit';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, private' };

export async function GET(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    const admins = await listAdminUsers();
    return NextResponse.json(
      {
        success: true,
        users: admins.map(sanitizeAdminUser),
        currentUserId: auth.session.uid,
        currentRole: auth.session.role,
        securityStatus: {
          hasCustomSessionSecret: hasDedicatedSessionSecret(),
          hasSetupSecret: Boolean(
            process.env.ADMIN_SETUP_SECRET && process.env.ADMIN_SETUP_SECRET.trim().length >= 16
          ),
          mfaEnforced: true,
        },
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to load admin accounts.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req, { requireSuperAdmin: true });
  if (!auth.ok) return auth.response;

  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || '';

  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role: PortalRole =
      body.role === 'super_admin'
        ? 'super_admin'
        : body.role === 'counselor'
        ? 'counselor'
        : 'admin';

    if (name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { success: false, error: 'Name must be between 2 and 80 characters.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid email address.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const pwCheck = validatePasswordStrength(password);
    if (!pwCheck.valid) {
      return NextResponse.json(
        { success: false, error: pwCheck.errors[0] },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const existing = await findPortalUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists.' },
        { status: 409, headers: NO_STORE_HEADERS }
      );
    }

    const supabase = createServerSupabaseClient();
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        role,
        name,
        status: 'active',
        session_version: 1,
        totp_enabled: false,
        failed_attempts: 0,
        locked_until: null,
        last_totp_step: 0,
      },
    });

    if (error || !created?.user) {
      return NextResponse.json(
        { success: false, error: error?.message || 'Failed to create account.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    await logSecurityEvent({
      event: 'ACCOUNT_CREATED',
      severity: 'INFO',
      actorEmail: auth.session.email,
      actorId: auth.session.uid,
      ip,
      userAgent: ua,
      path: '/api/auth/users',
      details: { createdEmail: email, role },
    });

    return NextResponse.json(
      {
        success: true,
        message:
          role === 'counselor'
            ? 'Counselor account created. Staff can sign in immediately at /counselor/login with email and password.'
            : 'Admin account created. User will enroll Google Authenticator on first login.',
        user: sanitizeAdminUser(created.user),
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create account.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminSession(req, { requireSuperAdmin: true });
  if (!auth.ok) return auth.response;

  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || '';

  try {
    const body = await req.json();
    const targetId = String(body.id || '').trim();
    const action = String(body.action || '').trim();
    const nextRole: PortalRole =
      body.role === 'super_admin'
        ? 'super_admin'
        : body.role === 'counselor'
        ? 'counselor'
        : 'admin';

    if (!isValidUuid(targetId)) {
      return NextResponse.json(
        { success: false, error: 'Valid account ID is required.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const supabase = createServerSupabaseClient();
    const { data: targetData, error: fetchErr } = await supabase.auth.admin.getUserById(targetId);
    if (fetchErr || !targetData?.user) {
      return NextResponse.json(
        { success: false, error: 'Admin account not found.' },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const target = targetData.user;
    const meta = (target.app_metadata || {}) as Record<string, any>;
    const admins = await listAdminUsers();
    const activeSuperAdmins = admins.filter(
      (a) => (a.app_metadata as any)?.role === 'super_admin' && (a.app_metadata as any)?.status === 'active'
    );

    if (action === 'disable' && target.id === auth.session.uid) {
      return NextResponse.json(
        { success: false, error: 'You cannot disable your own active Super Admin account.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (
      (action === 'disable' || (action === 'change_role' && nextRole !== 'super_admin')) &&
      meta.role === 'super_admin' &&
      activeSuperAdmins.length <= 1
    ) {
      return NextResponse.json(
        { success: false, error: 'Cannot remove or demote the last active Super Admin.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const nextMeta: Record<string, any> = { ...meta };
    let message = 'Account updated.';

    switch (action) {
      case 'unlock':
        nextMeta.failed_attempts = 0;
        nextMeta.locked_until = null;
        message = 'Account unlocked and failed attempt counter cleared.';
        break;
      case 'reset_mfa':
        nextMeta.totp_enabled = false;
        nextMeta.totp_secret_enc = null;
        nextMeta.backup_codes = [];
        nextMeta.last_totp_step = 0;
        nextMeta.session_version = Number(meta.session_version || 1) + 1;
        message = '2FA reset. Account must re-scan Authenticator QR on next login.';
        break;
      case 'revoke_sessions':
        nextMeta.session_version = Number(meta.session_version || 1) + 1;
        message = 'All active sessions revoked.';
        break;
      case 'disable':
        nextMeta.status = 'disabled';
        nextMeta.session_version = Number(meta.session_version || 1) + 1;
        message = 'Account disabled and all sessions revoked.';
        break;
      case 'enable':
        nextMeta.status = 'active';
        nextMeta.failed_attempts = 0;
        nextMeta.locked_until = null;
        message = 'Account re-enabled.';
        break;
      case 'change_role':
        if (target.id === auth.session.uid && nextRole !== 'super_admin') {
          return NextResponse.json(
            { success: false, error: 'You cannot demote your own Super Admin role.' },
            { status: 400, headers: NO_STORE_HEADERS }
          );
        }
        nextMeta.role = nextRole;
        nextMeta.session_version = Number(meta.session_version || 1) + 1;
        message = `Role updated to ${nextRole}.`;
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Unsupported action.' },
          { status: 400, headers: NO_STORE_HEADERS }
        );
    }

    const { data: updated, error: updErr } = await supabase.auth.admin.updateUserById(targetId, {
      app_metadata: nextMeta,
    });

    if (updErr || !updated?.user) {
      return NextResponse.json(
        { success: false, error: updErr?.message || 'Update failed.' },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    invalidateUserCache(targetId);

    await logSecurityEvent({
      event: `ACCOUNT_${action.toUpperCase()}`,
      severity: action === 'disable' || action === 'reset_mfa' ? 'WARN' : 'INFO',
      actorEmail: auth.session.email,
      actorId: auth.session.uid,
      ip,
      userAgent: ua,
      path: '/api/auth/users',
      details: { targetEmail: target.email, action, ...(action === 'change_role' ? { nextRole } : {}) },
    });

    return NextResponse.json(
      {
        success: true,
        message,
        user: sanitizeAdminUser(updated.user),
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update admin account.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdminSession(req, { requireSuperAdmin: true });
  if (!auth.ok) return auth.response;

  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || '';

  try {
    const { searchParams } = new URL(req.url);
    const idParam = (searchParams.get('id') || '').trim();

    if (!isValidUuid(idParam)) {
      return NextResponse.json(
        { success: false, error: 'Valid account ID is required.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (idParam === auth.session.uid) {
      return NextResponse.json(
        { success: false, error: 'You cannot delete your own account.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const admins = await listAdminUsers();
    const target = admins.find((a) => a.id === idParam);
    if (!target) {
      return NextResponse.json(
        { success: false, error: 'Admin account not found.' },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const superAdmins = admins.filter((a) => (a.app_metadata as any)?.role === 'super_admin');
    if ((target.app_metadata as any)?.role === 'super_admin' && superAdmins.length <= 1) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete the last Super Admin account.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const supabase = createServerSupabaseClient();
    const { error } = await supabase.auth.admin.deleteUser(idParam);
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    invalidateUserCache(idParam);

    await logSecurityEvent({
      event: 'ACCOUNT_DELETED',
      severity: 'CRITICAL',
      actorEmail: auth.session.email,
      actorId: auth.session.uid,
      ip,
      userAgent: ua,
      path: '/api/auth/users',
      details: { deletedEmail: target.email },
    });

    return NextResponse.json(
      { success: true, message: 'Admin account permanently deleted.' },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to delete account.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
