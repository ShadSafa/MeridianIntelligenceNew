import { getStore } from '@netlify/blobs';
import { verifyUser, jsonResponse } from '../lib/identity.mjs';

const STORE = 'meridian-waitlist';
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async (request) => {
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

// Enforced by Netlify at the edge, before this function is invoked, so a flood
// costs neither invocations nor storage. Ten per minute per IP is far more than
// a person joining a waitlist needs, while making scripted signup floods
// impractical. Excess requests get a 429.
export const config = {
  rateLimit: {
    windowSize: 60,
    windowLimit: 10,
    algorithm: 'sliding_window',
    aggregateBy: ['domain', 'ip']
  }
};
