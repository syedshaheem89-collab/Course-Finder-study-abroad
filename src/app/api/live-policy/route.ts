import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/security/session';
import { logSecurityEvent } from '@/lib/security/audit';
import { getClientIp } from '@/lib/security/rate-limit';
import { normalizeCountryName } from '@/lib/countries';
import {
  getLivePolicyStore,
  invalidateLivePolicyCache,
  sanitizeCountryOverride,
  saveLivePolicyStore,
} from '@/lib/live-policy-store';
import { LivePolicyUpdateItem } from '@/lib/live-policy-types';

export async function GET() {
  try {
    const store = await getLivePolicyStore(false);
    return NextResponse.json(
      {
        success: true,
        ...store,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to load live policy store' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const action = body.action === 'delete' ? 'delete' : 'upsert';
    const rawCountry = String(body.country || '').trim();
    const country = normalizeCountryName(rawCountry) || rawCountry;

    if (!country) {
      return NextResponse.json(
        { success: false, error: 'Country name is required.' },
        { status: 400 }
      );
    }

    const current = await getLivePolicyStore(true);
    const nextOverrides = { ...current.countryOverrides };
    let nextUpdates = [...current.policyUpdates];

    if (action === 'delete') {
      for (const k of Object.keys(nextOverrides)) {
        if (k.toLowerCase() === country.toLowerCase()) {
          delete nextOverrides[k];
        }
      }
    } else {
      const sanitized = sanitizeCountryOverride({
        country,
        stayBackYears: body.stayBackYears,
        bachelorStayBackYears: body.bachelorStayBackYears,
        phdStayBackYears: body.phdStayBackYears,
        visaSummary: body.visaSummary,
        showMoneyEur: body.showMoneyEur,
        showMoneyNote: body.showMoneyNote,
        sourceUrl: body.sourceUrl,
        sourceTitle: body.sourceTitle || 'Admin Verified Policy Rule',
        lastVerifiedAt: new Date().toISOString(),
        autoUpdated: false,
      });

      if (!sanitized) {
        return NextResponse.json(
          { success: false, error: 'Invalid policy override values.' },
          { status: 400 }
        );
      }

      nextOverrides[country] = sanitized;

      if (body.publishNews === true && body.newsTitle && body.newsSummary) {
        const item: LivePolicyUpdateItem = {
          country,
          title: String(body.newsTitle).trim().slice(0, 140),
          summary: String(body.newsSummary).trim().slice(0, 320),
          tag: body.newsTag || 'Visa & Stay-Back',
          publishedAt: new Date().toISOString(),
          sourceUrl: sanitized.sourceUrl,
          sourceName: sanitized.sourceTitle,
        };
        nextUpdates = [
          item,
          ...nextUpdates.filter(
            (u) => !(u.country.toLowerCase() === country.toLowerCase() && u.title.toLowerCase() === item.title.toLowerCase())
          ),
        ].slice(0, 30);
      }
    }

    const saved = await saveLivePolicyStore(
      {
        ...current,
        countryOverrides: nextOverrides,
        policyUpdates: nextUpdates,
      },
      auth.session.email
    );

    if (!saved) {
      return NextResponse.json(
        { success: false, error: 'Failed to save live policy override.' },
        { status: 500 }
      );
    }

    invalidateLivePolicyCache();

    await logSecurityEvent({
      event: 'LIVE_POLICY_UPDATED',
      severity: 'INFO',
      actorEmail: auth.session.email,
      actorId: auth.session.uid,
      ip: getClientIp(req),
      path: '/api/live-policy',
      details: { action, country },
    });

    const refreshed = await getLivePolicyStore(true);
    return NextResponse.json(
      { success: true, ...refreshed },
      { headers: { 'Cache-Control': 'no-store, private' } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update live policy' },
      { status: 500 }
    );
  }
}
