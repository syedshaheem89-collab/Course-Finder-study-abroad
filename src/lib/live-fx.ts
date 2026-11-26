const STATIC_RATES_PER_EUR: Record<string, number> = {
  EUR: 1,
  GBP: 0.85,
  USD: 1.08,
  CAD: 1.49,
  AUD: 1.65,
  NZD: 1.80,
  CHF: 0.94,
  SEK: 11.4,
  DKK: 7.46,
  NOK: 11.7,
  PLN: 4.30,
  CZK: 25.2,
  HUF: 398,
  JPY: 164,
  KRW: 1490,
  SGD: 1.44,
  AED: 3.97,
  GEL: 2.95,
  ALL: 99,
  BGN: 1.96,
  INR: 92,
};

interface CachedFxState {
  rates: Record<string, number>;
  fetchedAt: number;
  isLive: boolean;
}

const globalForFx = globalThis as unknown as {
  __orbisFxCache?: CachedFxState;
};

export function normalizeCurrencyCode(raw?: string | null): string {
  const s = String(raw || '').trim();
  if (!s) return 'EUR';
  const upper = s.toUpperCase();
  if (upper.includes('€') || upper === 'EUR' || upper === 'EURO' || upper === 'EUROS') return 'EUR';
  if (upper.includes('£') || upper === 'GBP' || upper === 'POUND' || upper === 'POUNDS') return 'GBP';
  if (upper.includes('A$') || upper.includes('AU$') || upper === 'AUD') return 'AUD';
  if (upper.includes('C$') || upper.includes('CA$') || upper === 'CAD') return 'CAD';
  if (upper.includes('NZ$') || upper === 'NZD') return 'NZD';
  if (upper.includes('S$') || upper.includes('SG$') || upper === 'SGD') return 'SGD';
  if (upper === 'USD' || upper === 'US$' || upper === '$') return 'USD';
  if (upper === 'SEK' || upper === 'KR' && upper.includes('SEK')) return 'SEK';
  if (upper === 'DKK') return 'DKK';
  if (upper === 'NOK') return 'NOK';
  if (upper === 'CHF') return 'CHF';
  if (upper === 'PLN' || upper === 'ZL' || upper === 'ZŁ') return 'PLN';
  if (upper === 'CZK' || upper === 'KČ') return 'CZK';
  if (upper === 'HUF' || upper === 'FT') return 'HUF';
  if (upper === 'JPY' || upper.includes('¥')) return 'JPY';
  if (upper === 'KRW' || upper.includes('₩')) return 'KRW';
  if (upper === 'AED' || upper === 'DHS') return 'AED';
  if (upper === 'GEL' || upper === 'LARI') return 'GEL';
  if (upper === 'ALL' || upper === 'LEK') return 'ALL';
  if (upper === 'BGN') return 'BGN';
  if (upper === 'INR' || upper.includes('₹')) return 'INR';

  const alpha3 = upper.match(/\b([A-Z]{3})\b/);
  if (alpha3 && STATIC_RATES_PER_EUR[alpha3[1]]) {
    return alpha3[1];
  }
  return 'EUR';
}

export async function getLiveEurRates(): Promise<{
  rates: Record<string, number>;
  source: 'ecb-live' | 'fallback';
}> {
  const now = Date.now();
  const cached = globalForFx.__orbisFxCache;
  if (cached && now - cached.fetchedAt < 12 * 3600_000) {
    return {
      rates: cached.rates,
      source: cached.isLive ? 'ecb-live' : 'fallback',
    };
  }

  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=EUR', {
      signal: AbortSignal.timeout(3500),
      headers: { 'User-Agent': 'Orbis/2026' },
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.rates && typeof json.rates === 'object') {
        const merged: Record<string, number> = { ...STATIC_RATES_PER_EUR, EUR: 1 };
        for (const [k, v] of Object.entries(json.rates)) {
          const n = Number(v);
          if (Number.isFinite(n) && n > 0) {
            merged[k.toUpperCase()] = n;
          }
        }
        globalForFx.__orbisFxCache = { rates: merged, fetchedAt: now, isLive: true };
        return { rates: merged, source: 'ecb-live' };
      }
    }
  } catch {
    // Non-fatal: use static fallback rates
  }

  const fb = { ...STATIC_RATES_PER_EUR };
  globalForFx.__orbisFxCache = { rates: fb, fetchedAt: now, isLive: false };
  return { rates: fb, source: 'fallback' };
}

export async function convertCurrencyToEur(
  amount: number,
  currencyCode?: string | null
): Promise<{
  eur: number;
  currency: string;
  rateUsed: number;
  source: 'ecb-live' | 'fallback';
}> {
  const code = normalizeCurrencyCode(currencyCode);
  if (!Number.isFinite(amount) || amount < 0) {
    return { eur: 0, currency: code, rateUsed: 1, source: 'fallback' };
  }
  if (code === 'EUR') {
    return { eur: Math.round(amount), currency: 'EUR', rateUsed: 1, source: 'ecb-live' };
  }
  const { rates, source } = await getLiveEurRates();
  const rate = rates[code] || STATIC_RATES_PER_EUR[code] || 1;
  return {
    eur: Math.round(amount / rate),
    currency: code,
    rateUsed: rate,
    source,
  };
}
