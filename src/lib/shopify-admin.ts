// Server-only Shopify Admin API access for the embedded app.
// Flow: App Bridge session token (id token) → verify with the app secret → token exchange → Admin GraphQL.
// Import this only from server function handlers; it reads SHOPIFY_API_SECRET.

const ADMIN_API_VERSION = "2026-07";

const tokenCache = new Map<string, string>();

function requireEnv(name: "SHOPIFY_API_KEY" | "SHOPIFY_API_SECRET") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/**
 * Checks a webhook's X-Shopify-Hmac-Sha256 header against the raw request body.
 * `crypto.subtle.verify` compares in constant time.
 */
export async function verifyWebhookHmac(rawBody: ArrayBuffer, hmacHeader: string | null): Promise<boolean> {
  if (!hmacHeader) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(requireEnv("SHOPIFY_API_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, Buffer.from(hmacHeader, "base64"), rawBody);
}

/** Verifies an App Bridge session token and returns the shop domain it was issued for. */
export async function verifySessionToken(idToken: string): Promise<string> {
  const [header, payload, signature] = idToken.split(".");
  if (!header || !payload || !signature) throw new Error("Malformed session token");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(requireEnv("SHOPIFY_API_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    Buffer.from(signature, "base64url"),
    new TextEncoder().encode(`${header}.${payload}`),
  );
  if (!valid) throw new Error("Invalid session token signature");

  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    aud?: string;
    dest?: string;
    exp?: number;
    nbf?: number;
  };
  const now = Math.floor(Date.now() / 1000);
  const leeway = 10;
  if (!claims.exp || claims.exp + leeway < now) throw new Error("Session token expired");
  if (claims.nbf && claims.nbf - leeway > now) throw new Error("Session token not yet valid");
  if (claims.aud !== requireEnv("SHOPIFY_API_KEY"))
    throw new Error("Session token was issued for another app");

  const shop = claims.dest ? new URL(claims.dest).hostname : "";
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop))
    throw new Error("Invalid shop in session token");
  return shop;
}

async function exchangeForAccessToken(shop: string, idToken: string): Promise<string> {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("SHOPIFY_API_KEY"),
      client_secret: requireEnv("SHOPIFY_API_SECRET"),
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: idToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
    }),
  });
  if (!response.ok)
    throw new Error(`Token exchange failed (${response.status}): ${await response.text()}`);
  const { access_token } = (await response.json()) as { access_token?: string };
  if (!access_token) throw new Error("Token exchange returned no access token");
  return access_token;
}

export interface AdminClient {
  shop: string;
  graphql: <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;
}

/** Returns an Admin GraphQL client for the shop that issued the session token. */
export async function adminClientFromSessionToken(idToken: string): Promise<AdminClient> {
  const shop = await verifySessionToken(idToken);

  const request = async <T>(
    query: string,
    variables: Record<string, unknown>,
    retry: boolean,
  ): Promise<T> => {
    let accessToken = tokenCache.get(shop);
    if (!accessToken) {
      accessToken = await exchangeForAccessToken(shop, idToken);
      tokenCache.set(shop, accessToken);
    }
    const response = await fetch(`https://${shop}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
      body: JSON.stringify({ query, variables }),
    });
    if (response.status === 401 && retry) {
      tokenCache.delete(shop);
      return request<T>(query, variables, false);
    }
    if (!response.ok) throw new Error(`Admin API request failed (${response.status})`);
    const payload = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
    if (payload.errors?.length)
      throw new Error(payload.errors.map((error) => error.message).join(", "));
    if (!payload.data) throw new Error("Admin API returned no data");
    return payload.data;
  };

  return { shop, graphql: (query, variables = {}) => request(query, variables, true) };
}
