import crypto from 'crypto';
import { createServerSupabaseClient } from '@/lib/supabase';

export type SecuritySeverity = 'INFO' | 'WARN' | 'CRITICAL';

export interface SecurityAuditEntry {
  id: string;
  event: string;
  severity: SecuritySeverity;
  actor_email: string | null;
  actor_id: string | null;
  ip: string | null;
  user_agent: string | null;
  path: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const globalForAudit = globalThis as unknown as {
  __gcSecurityAuditBuffer?: SecurityAuditEntry[];
};

const memoryBuffer =
  globalForAudit.__gcSecurityAuditBuffer ||
  (globalForAudit.__gcSecurityAuditBuffer = []);

function pushToMemoryBuffer(entry: SecurityAuditEntry) {
  memoryBuffer.unshift(entry);
  if (memoryBuffer.length > 200) {
    memoryBuffer.length = 200;
  }
}

export async function logSecurityEvent(params: {
  event: string;
  severity: SecuritySeverity;
  actorEmail?: string | null;
  actorId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  path?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  const entry: SecurityAuditEntry = {
    id: crypto.randomUUID(),
    event: params.event,
    severity: params.severity,
    actor_email: params.actorEmail ?? null,
    actor_id: params.actorId ?? null,
    ip: params.ip ?? null,
    user_agent: params.userAgent ? params.userAgent.slice(0, 200) : null,
    path: params.path ?? null,
    details: params.details ?? {},
    created_at: new Date().toISOString(),
  };

  pushToMemoryBuffer(entry);

  try {
    const supabase = createServerSupabaseClient();
    await (supabase.from('security_audit_logs') as any).insert({
      event: entry.event,
      severity: entry.severity,
      actor_email: entry.actor_email,
      actor_id: entry.actor_id,
      ip: entry.ip,
      user_agent: entry.user_agent,
      path: entry.path,
      details: entry.details,
      created_at: entry.created_at,
    });
  } catch {
    // Table may not be migrated yet — non-fatal
  }

  // Zero-migration persistence: compact summary on the actor's app_metadata when actorId is known
  if (entry.actor_id) {
    try {
      const supabase = createServerSupabaseClient();
      const { data } = await supabase.auth.admin.getUserById(entry.actor_id);
      if (data?.user) {
        const currentMeta = (data.user.app_metadata || {}) as Record<string, any>;
        const existingEvents = Array.isArray(currentMeta.recent_security_events)
          ? currentMeta.recent_security_events
          : [];
        const compact = {
          id: entry.id,
          event: entry.event,
          severity: entry.severity,
          actor_email: entry.actor_email || data.user.email || null,
          ip: entry.ip,
          path: entry.path,
          details: entry.details,
          created_at: entry.created_at,
        };
        const nextEvents = [compact, ...existingEvents].slice(0, 15);
        await supabase.auth.admin.updateUserById(entry.actor_id, {
          app_metadata: {
            ...currentMeta,
            recent_security_events: nextEvents,
          },
        });
      }
    } catch {
      // Non-fatal
    }
  }
}

export async function getRecentAuditLogs(limit = 100): Promise<SecurityAuditEntry[]> {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await (supabase.from('security_audit_logs') as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!error && Array.isArray(data) && data.length > 0) {
      return data as SecurityAuditEntry[];
    }
  } catch {
    // Fallback below
  }

  const combinedMap = new Map<string, SecurityAuditEntry>();
  for (const item of memoryBuffer) {
    combinedMap.set(item.id, item);
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 200 });
    for (const user of usersData?.users || []) {
      const events = (user.app_metadata as any)?.recent_security_events;
      if (Array.isArray(events)) {
        for (const ev of events) {
          if (ev?.id && !combinedMap.has(ev.id)) {
            combinedMap.set(ev.id, {
              id: ev.id,
              event: String(ev.event || 'EVENT'),
              severity: (ev.severity as SecuritySeverity) || 'INFO',
              actor_email: ev.actor_email || user.email || null,
              actor_id: user.id,
              ip: ev.ip || null,
              user_agent: null,
              path: ev.path || null,
              details: ev.details || {},
              created_at: ev.created_at || new Date().toISOString(),
            });
          }
        }
      }
    }
  } catch {
    // Ignore fallback error
  }

  return Array.from(combinedMap.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}
