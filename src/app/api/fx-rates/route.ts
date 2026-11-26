import { NextResponse } from 'next/server';
import { getLiveEurRates } from '@/lib/live-fx';

export async function GET() {
  try {
    const { rates, source } = await getLiveEurRates();
    return NextResponse.json(
      {
        success: true,
        base: 'EUR',
        rates,
        source,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to load FX rates' },
      { status: 500 }
    );
  }
}
