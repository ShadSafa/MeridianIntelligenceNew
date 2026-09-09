// Sliding-window rate limiter backed by Netlify Blobs.
//
// Netlify has no platform-level rate limiting to lean on, so this runs inside
// the function. It lives in its own blob store: the waitlist store is
// enumerated by the admin listing, and counters must not show up there.

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

// Counters are keyed by a salted hash rather than the address itself, so the
// store never holds a raw IP.
async function counterKey(ip) {
  const bytes = new TextEncoder().encode(`meridian-waitlist|${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function clientIp(request, context) {
  if (context && typeof context.ip === 'string' && context.ip) return context.ip;
  const forwarded = request.headers.get('x-nf-client-connection-ip')
    || request.headers.get('x-forwarded-for');
  if (!forwarded) return null;
  return forwarded.split(',')[0].trim() || null;
}

/**
 * Records a request and reports whether the caller has exceeded the window.
 * Fails open: if the counter store is unreachable the signup still goes
 * through, because losing the waitlist entirely is worse than not throttling.
 */
export async function exceedsLimit(store, ip) {
  if (!ip) return false;

  try {
    const key = await counterKey(ip);
    const now = Date.now();
    const record = await store.get(key, { type: 'json' });

    const hits = Array.isArray(record && record.hits) ? record.hits : [];
    const recent = hits.filter((t) => typeof t === 'number' && now - t < WINDOW_MS);

    if (recent.length >= MAX_REQUESTS) return true;

    recent.push(now);
    // Only ever holds the current window, so a given IP stays one small blob.
    await store.setJSON(key, { hits: recent });
    return false;
  } catch (error) {
    console.error('rate limit check failed:', error && error.message);
    return false;
  }
}

export const LIMIT = MAX_REQUESTS;
export const WINDOW_SECONDS = WINDOW_MS / 1000;
