// Verifies a Netlify Identity bearer token by asking Identity itself.
//
// Functions v2 does not expose the `clientContext.user` that the legacy Lambda
// signature provided, so the token is handed to the Identity /user endpoint,
// which checks the signature and expiry. A forged, expired, or revoked token
// comes back 401 and this returns null. No JWT crypto is hand-rolled here.

export async function verifyUser(request) {
  const header = request.headers.get('authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) return null;

  let endpoint;
  try {
    endpoint = new URL('/.netlify/identity/user', request.url).toString();
  } catch {
    return null;
  }

  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: header }
    });
    if (!response.ok) return null;

    const user = await response.json();
    return user && user.email ? user : null;
  } catch {
    return null;
  }
}

export function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}
