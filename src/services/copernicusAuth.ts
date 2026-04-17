/**
 * Copernicus Data Space Ecosystem — OAuth2 token manager
 *
 * Uses client_credentials grant with COPERNICUS_CLIENT_ID / COPERNICUS_CLIENT_SECRET.
 * Tokens expire in 600 s (10 min); we cache and auto-refresh 30 s early.
 */

interface TokenCache {
  token: string;
  expiresAt: number; // ms epoch
}

let cache: TokenCache | null = null;

const TOKEN_URL =
  "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";

export async function getCopernicusToken(): Promise<string> {
  if (cache && cache.expiresAt > Date.now() + 30_000) {
    return cache.token;
  }

  const clientId     = process.env.COPERNICUS_CLIENT_ID;
  const clientSecret = process.env.COPERNICUS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("COPERNICUS_CLIENT_ID / COPERNICUS_CLIENT_SECRET env vars not set");
  }

  const res = await fetch(TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     clientId,
      client_secret: clientSecret,
    }).toString(),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Copernicus OAuth HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };

  console.log(`🔑 Copernicus token refreshed (expires in ${data.expires_in}s)`);
  return cache.token;
}

/** Returns true if credentials are configured in env */
export function hasCopernicusCredentials(): boolean {
  return !!(process.env.COPERNICUS_CLIENT_ID && process.env.COPERNICUS_CLIENT_SECRET);
}
