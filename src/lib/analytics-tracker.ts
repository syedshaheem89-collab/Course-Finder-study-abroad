export type AnalyticsEventType =
  | 'search'
  | 'country_select'
  | 'course_view'
  | 'ai_recommend'
  | 'excel_export';

export interface TrafficAttribution {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  referrer: string;
  device_type: 'Mobile' | 'Desktop';
}

const UTM_STORAGE_KEY = 'gc_utm_v1';
const STAFF_BYPASS_KEY = 'gc_staff_bypass_v1';

let staffBypassMemory = false;

export function setStaffAnalyticsBypass(active: boolean): void {
  staffBypassMemory = active;
  if (typeof window === 'undefined') return;
  try {
    if (active) {
      sessionStorage.setItem(STAFF_BYPASS_KEY, '1');
    } else {
      sessionStorage.removeItem(STAFF_BYPASS_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function isStaffAnalyticsBypassed(): boolean {
  if (staffBypassMemory) return true;
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(STAFF_BYPASS_KEY) === '1';
  } catch {
    return false;
  }
}

export function getTrafficAttribution(): TrafficAttribution {
  if (typeof window === 'undefined') {
    return {
      utm_source: '',
      utm_medium: '',
      utm_campaign: '',
      referrer: '',
      device_type: 'Desktop',
    };
  }

  let utm_source = '';
  let utm_medium = '';
  let utm_campaign = '';

  try {
    const params = new URLSearchParams(window.location.search);
    const urlSrc = params.get('utm_source')?.trim() || '';
    const urlMed = params.get('utm_medium')?.trim() || '';
    const urlCamp = params.get('utm_campaign')?.trim() || '';

    if (urlSrc || urlMed || urlCamp) {
      utm_source = urlSrc.slice(0, 80);
      utm_medium = urlMed.slice(0, 80);
      utm_campaign = urlCamp.slice(0, 80);
      sessionStorage.setItem(
        UTM_STORAGE_KEY,
        JSON.stringify({ utm_source, utm_medium, utm_campaign })
      );
    } else {
      const saved = sessionStorage.getItem(UTM_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        utm_source = String(parsed.utm_source || '').slice(0, 80);
        utm_medium = String(parsed.utm_medium || '').slice(0, 80);
        utm_campaign = String(parsed.utm_campaign || '').slice(0, 80);
      }
    }
  } catch {
    // Ignore storage / URL errors
  }

  let referrer = '';
  try {
    if (document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, '');
      if (host && host !== window.location.hostname) {
        referrer = host.slice(0, 100);
      }
    }
  } catch {
    referrer = '';
  }

  const device_type: 'Mobile' | 'Desktop' =
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'Mobile' : 'Desktop';

  return { utm_source, utm_medium, utm_campaign, referrer, device_type };
}

export function trackAnalyticsEvent(payload: {
  event_type: AnalyticsEventType;
  country?: string;
  query?: string;
  degree_level?: string;
  subject?: string;
  budget_tier?: string;
  intake?: string;
  english_status?: string;
  city?: string;
  course_name?: string;
  university_name?: string;
}): void {
  if (typeof window === 'undefined') return;
  if (isStaffAnalyticsBypassed()) return;
  try {
    const attribution = getTrafficAttribution();
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, ...attribution }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Fire-and-forget: never disrupt user flow
  }
}
