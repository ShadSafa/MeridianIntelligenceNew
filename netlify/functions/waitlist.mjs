import { getStore } from '@netlify/blobs';
import { verifyUser, jsonResponse } from '../lib/identity.mjs';
import { clientIp, exceedsLimit, LIMIT, WINDOW_SECONDS } from '../lib/rate-limit.mjs';

const STORE = 'meridian-waitlist';
const RATE_STORE = 'meridian-waitlist-rate';
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async (request, context) => {
  let store;
  try {
    store = getStore(STORE);
  } catch (error) {
    console.error('getStore failed:', error && error.message);
    return jsonResponse(503, { error: 'Waitlist storage is unavailable.' });
  }

  // Reading the list is an admin action: it exposes everyone's email address.
  if (request.method === 'GET') {
    const user = await verifyUser(request);
    if (!user) {
      return jsonResponse(401, { error: 'Sign in to view the waitlist.' });
    }
    try {
      const { blobs } = await store.list();
      const entries = await Promise.all(
        blobs.map((blob) => store.get(blob.key, { type: 'json' }))
      );
      const found = entries.filter(Boolean);
      return jsonResponse(200, { count: found.length, entries: found });
    } catch (error) {
      console.error('list failed:', error && error.message);
      return jsonResponse(500, { error: 'Could not load the waitlist.' });
    }
  }

  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } });
  }

  // Checked before the body is even parsed, so a flood is turned away as
  // cheaply as possible.
  try {
    const rateStore = getStore(RATE_STORE);
    if (await exceedsLimit(rateStore, clientIp(request, context))) {
      return new Response(
        JSON.stringify({ error: 'Too many attempts. Please wait a minute and try again.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Retry-After': String(WINDOW_SECONDS),
            'X-RateLimit-Limit': String(LIMIT)
          }
        }
      );
    }
  } catch (error) {
    console.error('rate store unavailable:', error && error.message);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Malformed request.' });
  }

  // Bots fill in every field they find; humans never see this one.
  if (payload.company) {
    return jsonResponse(201, { message: 'Thanks for joining the waitlist.' });
  }

  const raw = typeof payload.email === 'string' ? payload.email.trim() : '';
  if (!raw || raw.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(raw)) {
    return jsonResponse(400, { error: 'Please enter a valid email address.' });
  }

  // The lowercased address is the blob key, so a duplicate can only ever
  // overwrite its own record rather than create a second one.
  const key = raw.toLowerCase();

  try {
    const existing = await store.get(key, { type: 'json' });
    if (existing) {
      return jsonResponse(409, { error: 'This email is already on the waitlist.' });
    }

    await store.setJSON(key, { email: raw, joinedAt: new Date().toISOString() });
    return jsonResponse(201, { message: 'Thanks for joining the waitlist.' });
  } catch (error) {
    console.error('write failed:', error && error.message);
    return jsonResponse(500, { error: 'Could not save your email. Please try again.' });
  }
};
