// Stands in for netlify/lib/identity.mjs so tests do not need a live Identity
// service. Only a token this module recognises counts as signed in, mirroring
// the real contract: anything unrecognised yields null.

export const VALID_TOKEN = 'Bearer test-admin-token';

export async function verifyUser(request) {
  const header = request.headers.get('authorization');
  if (header !== VALID_TOKEN) return null;
  return { email: 'admin@meridianintelligence.co' };
}

export function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
