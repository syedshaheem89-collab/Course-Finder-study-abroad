import dns from 'dns/promises';
import net from 'net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
]);

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b, c] = parts;

  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
  if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  return false;
}

export function isPrivateIp(rawIp: string): boolean {
  const ip = String(rawIp || '').replace(/^\[|\]$/g, '').split('%')[0].trim().toLowerCase();
  if (!ip) return true;

  if (net.isIPv4(ip)) {
    return isPrivateIpv4(ip);
  }

  if (!net.isIPv6(ip)) {
    return true;
  }

  if (ip === '::' || ip === '::1' || ip === '0:0:0:0:0:0:0:0' || ip === '0:0:0:0:0:0:0:1') {
    return true;
  }

  // IPv4-mapped IPv6 dotted form: ::ffff:127.0.0.1
  if (ip.startsWith('::ffff:')) {
    const rest = ip.slice('::ffff:'.length);
    if (net.isIPv4(rest)) {
      return isPrivateIpv4(rest);
    }
    // Hex form from WHATWG URL parser, e.g. ::ffff:7f00:1
    const hexMatch = rest.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (hexMatch) {
      const hi = parseInt(hexMatch[1], 16);
      const lo = parseInt(hexMatch[2], 16);
      const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      return isPrivateIpv4(ipv4);
    }
    return true;
  }

  // Extract first 16-bit hextet to check ULA (fc00::/7), link-local (fe80::/10), multicast (ff00::/8)
  const firstHextetStr = ip.split(':')[0];
  if (firstHextetStr) {
    const firstHextet = parseInt(firstHextetStr, 16);
    if (!Number.isNaN(firstHextet)) {
      if ((firstHextet & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
      if ((firstHextet & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
      if ((firstHextet & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    }
  }

  // ::/96 IPv4-compatible IPv6
  if (ip.startsWith('::') && net.isIPv4(ip.slice(2))) {
    return isPrivateIpv4(ip.slice(2));
  }

  return false;
}

/**
 * Validates that an external URL is public http/https and resolves strictly to public IP addresses.
 */
export async function assertSafeExternalUrl(rawUrl: string): Promise<URL> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Invalid external URL.');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('Malformed external URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// URLs are permitted.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('Embedded credentials in URLs are not permitted.');
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname) {
    throw new Error('URL hostname is missing.');
  }

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.arpa')
  ) {
    throw new Error('Internal or reserved hostnames are blocked for security.');
  }

  if (net.isIP(hostname) !== 0) {
    if (isPrivateIp(hostname)) {
      throw new Error('Private or loopback IP targets are blocked.');
    }
    return parsed;
  }

  let addresses: { address: string; family: number }[] = [];
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error(`Could not resolve hostname: ${hostname}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new Error(`No DNS records found for hostname: ${hostname}`);
  }

  for (const record of addresses) {
    if (isPrivateIp(record.address)) {
      throw new Error('Resolved destination IP is inside a private or restricted network.');
    }
  }

  return parsed;
}

/**
 * Fetches an external URL safely with SSRF checks on initial target and up to 3 redirects,
 * plus hard timeout and response size limits.
 */
export async function safeFetchExternal(
  rawUrl: string,
  opts?: { headers?: Record<string, string>; timeoutMs?: number; maxBytes?: number }
): Promise<{
  ok: boolean;
  status: number;
  contentType: string;
  buffer: Buffer;
  finalUrl: string;
}> {
  const timeoutMs = opts?.timeoutMs ?? 10_000;
  const maxBytes = opts?.maxBytes ?? 5_000_000;

  let currentUrl = (await assertSafeExternalUrl(rawUrl)).toString();
  let res: Response | null = null;

  for (let redirects = 0; redirects <= 3; redirects++) {
    res = await fetch(currentUrl, {
      method: 'GET',
      headers: opts?.headers,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) break;
      const nextParsed = await assertSafeExternalUrl(new URL(loc, currentUrl).toString());
      currentUrl = nextParsed.toString();
      continue;
    }

    break;
  }

  if (!res) {
    throw new Error('External fetch produced no response.');
  }

  const contentLength = Number(res.headers.get('content-length') || 0);
  if (contentLength > maxBytes) {
    throw new Error(`Remote file exceeds maximum allowed size of ${maxBytes} bytes.`);
  }

  const reader = res.body?.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          throw new Error(`Remote response exceeded maximum size limit (${maxBytes} bytes).`);
        }
        chunks.push(Buffer.from(value));
      }
    }
  }

  return {
    ok: res.ok,
    status: res.status,
    contentType: res.headers.get('content-type') || '',
    buffer: Buffer.concat(chunks),
    finalUrl: currentUrl,
  };
}
