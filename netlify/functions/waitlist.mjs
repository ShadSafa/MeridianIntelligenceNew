import { getStore } from '@netlify/blobs';

const STORE = 'meridian-waitlist';
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});

export const handler = async (event, context) => {
  let store;
  try {
    store = getStore(STORE);
  } catch (error) {
    // Logged rather than swallowed: without this the 503 is undiagnosable.
    console.error('getStore failed:', error && error.message);
    return json(503, { error: 'Waitlist storage is unavailable.' });
  }

  // Reading the list is an admin action: it exposes everyone's email address.
  if (event.httpMethod === 'GET') {
    const user = context.clientContext && context.clientContext.user;
    if (!user) {
      return json(401, { error: 'Sign in to view the waitlist.' });
    }
    try {
      const { blobs } = await store.list();
      const entries = await Promise.all(
        blobs.map((blob) => store.get(blob.key, { type: 'json' }))
      );
      const found = entries.filter(Boolean);
      return json(200, { count: found.length, entries: found });
    } catch {
      return json(500, { error: 'Could not load the waitlist.' });
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { Allow: 'GET, POST' }, body: '' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Malformed request.' });
  }

  // Bots fill in every field they find; humans never see this one.
  if (payload.company) {
    return json(201, { message: 'Thanks for joining the waitlist.' });
  }

  const raw = typeof payload.email === 'string' ? payload.email.trim() : '';
  if (!raw || raw.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(raw)) {
    return json(400, { error: 'Please enter a valid email address.' });
  }

  // The lowercased address is the blob key, so a duplicate can only ever
  // overwrite its own record rather than create a second one.
  const key = raw.toLowerCase();

  try {
    const existing = await store.get(key, { type: 'json' });
    if (existing) {
      return json(409, { error: 'This email is already on the waitlist.' });
    }

    await store.setJSON(key, { email: raw, joinedAt: new Date().toISOString() });
    return json(201, { message: 'Thanks for joining the waitlist.' });
  } catch {
    return json(500, { error: 'Could not save your email. Please try again.' });
  }
};
