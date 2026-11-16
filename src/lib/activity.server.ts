// Server-only, store-level activity. Never stores visitor IDs, IPs, or page URLs.
import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "cursorforge:activity:";
const RETENTION = 90 * 86400;
const SHOP = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
export function activityConfigured() {
  return Boolean(process.env["UPSTASH_REDIS_REST_URL"] && process.env["UPSTASH_REDIS_REST_TOKEN"]);
}

async function redis(commands: Array<Array<string | number>>) {
  if (!activityConfigured()) throw new Error("Activity storage is not configured");
  const response = await fetch(
    `${process.env["UPSTASH_REDIS_REST_URL"]!.replace(/\/$/, "")}/pipeline`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env["UPSTASH_REDIS_REST_TOKEN"]}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(2500),
    },
  );
  if (!response.ok) throw new Error("Activity storage request failed");
  const results = (await response.json()) as Array<{ result: unknown; error?: string }>;
  if (results.some((item) => item.error)) throw new Error("Activity storage command failed");
  return results.map((item) => item.result);
}

export function storefrontActivityUrl(shop: string) {
  const origin = process.env["ACTIVITY_PUBLIC_URL"];
  const secret = process.env["SHOPIFY_API_SECRET"];
  if (!activityConfigured() || !origin || !secret || !SHOP.test(shop)) return null;
  const payload = Buffer.from(`${shop}|${Math.floor(Date.now() / 1000) + RETENTION}`).toString(
    "base64url",
  );
  const signature = createHmac("sha256", secret).update(`activity:${payload}`).digest("base64url");
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:") return null;
    return `${parsed.origin}/api/activity/storefront?token=${payload}.${signature}`;
  } catch {
    return null;
  }
}

export function verifyActivityToken(token: string): string | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || !process.env["SHOPIFY_API_SECRET"]) return null;
  const expected = createHmac("sha256", process.env["SHOPIFY_API_SECRET"])
    .update(`activity:${payload}`)
    .digest();
  const supplied = Buffer.from(signature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  const [shop, expires] = Buffer.from(payload, "base64url").toString().split("|");
  return shop && SHOP.test(shop) && Number(expires) > Date.now() / 1000 ? shop : null;
}

// One storefront signal per store per minute, regardless of traffic. Atomic with the write.
const RECORD = `
if ARGV[1] == 'storefront' then
  if not redis.call('SET', KEYS[3], '1', 'NX', 'EX', 60) then return 0 end
end
redis.call('HSETNX', KEYS[1], 'firstSeen', ARGV[2])
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
if ARGV[3] ~= '' then redis.call('HSET', KEYS[1], 'cursorPublishedEnabled', ARGV[3]) end
redis.call('EXPIRE', KEYS[1], ARGV[4])
redis.call('ZADD', KEYS[2], ARGV[2], ARGV[5])
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', ARGV[6])
return 1`;

export async function recordActivity(
  shop: string,
  event: "opened" | "published" | "storefront",
  enabled?: boolean,
) {
  if (!activityConfigured()) return;
  if (!SHOP.test(shop)) throw new Error("Invalid activity shop");
  const now = Date.now();
  await redis([
    [
      "EVAL",
      RECORD,
      3,
      PREFIX + shop,
      PREFIX + "shops",
      PREFIX + "rate:" + shop,
      event,
      now,
      enabled === undefined ? "" : String(enabled),
      RETENTION,
      shop,
      now - RETENTION * 1000,
    ],
  ]);
}

export async function recordActivitySafely(
  shop: string,
  event: "opened" | "published",
  enabled?: boolean,
) {
  try {
    await recordActivity(shop, event, enabled);
  } catch {
    console.error("Could not persist store activity");
  }
}

export async function deleteShopActivity(shop: string) {
  if (!activityConfigured() || !SHOP.test(shop)) return;
  await redis([
    ["DEL", PREFIX + shop, PREFIX + "rate:" + shop],
    ["ZREM", PREFIX + "shops", shop],
  ]);
}

type ActivityRow = {
  shop: string;
  firstSeen?: string;
  opened?: string;
  published?: string;
  storefront?: string;
  cursorPublishedEnabled?: string;
};

export async function listActivity(): Promise<ActivityRow[]> {
  const [shops] = await redis([
    ["ZRANGEBYSCORE", PREFIX + "shops", Date.now() - RETENTION * 1000, "+inf"],
  ]);
  if (!(shops as string[]).length) return [];
  const rows = await redis((shops as string[]).map((shop) => ["HGETALL", PREFIX + shop]));
  return rows.flatMap((row, index) => {
    const fields = row as string[];
    if (!fields.length) return [];
    const values: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) values[fields[i]!] = fields[i + 1]!;
    return [{ shop: (shops as string[])[index]!, ...values }];
  });
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
}

export async function handleActivityRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/internal/activity" && url.pathname !== "/api/activity/storefront")
    return null;
  const headers = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
  };
  if (request.method !== "GET") return new Response(null, { status: 405, headers });
  if (url.pathname === "/api/activity/storefront") {
    const shop = verifyActivityToken(url.searchParams.get("token") ?? "");
    if (!shop) return new Response(null, { status: 401, headers });
    if (!activityConfigured()) return new Response(null, { status: 503, headers });
    try {
      await recordActivity(shop, "storefront");
    } catch {
      return new Response(null, { status: 503, headers });
    }
    return new Response(null, { status: 204, headers });
  }
  const password = process.env["ACTIVITY_DASHBOARD_PASSWORD"];
  if (!password)
    return new Response("Activity dashboard is not configured", { status: 503, headers });
  const authorization = request.headers.get("authorization") ?? "";
  const credentials = authorization.startsWith("Basic ")
    ? Buffer.from(authorization.slice(6), "base64").toString()
    : "";
  const supplied = Buffer.from(credentials.slice(credentials.indexOf(":") + 1));
  const expected = Buffer.from(password);
  if (
    !credentials.startsWith("admin:") ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return new Response("Sign in as admin", {
      status: 401,
      headers: {
        ...headers,
        "WWW-Authenticate": 'Basic realm="CursorForge owner", charset="UTF-8"',
      },
    });
  }
  try {
    const rows = await listActivity();
    const week = Date.now() - 7 * 86400000;
    const date = (value?: string) =>
      value
        ? escapeHtml(new Date(Number(value)).toISOString().replace("T", " ").slice(0, 16))
        : "Not observed";
    const active = rows.filter((row) => Number(row.storefront) >= week).length;
    const opened = rows.filter((row) => Number(row.opened) >= week).length;
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CursorForge activity</title><style>body{font:16px system-ui;background:#f5f5f2;color:#18251e;margin:32px}main{max-width:1150px;margin:auto}section{overflow:auto;background:white;padding:20px;border-radius:12px}table{border-collapse:collapse;width:100%;white-space:nowrap}td,th{text-align:left;padding:14px;border-bottom:1px solid #ddd}p{line-height:1.6}small{color:#555}</style><main><h1>CursorForge store activity</h1><p><strong>${active}</strong> stores with storefront cursor loads in the last 7 days · <strong>${opened}</strong> opened the app · <strong>${rows.length}</strong> observed stores</p><section><table><thead><tr><th>Store</th><th>First observed</th><th>Last app open</th><th>Last publish</th><th>Published cursor</th><th>Last storefront load</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.shop)}</td><td>${date(row.firstSeen)}</td><td>${date(row.opened)}</td><td>${date(row.published)}</td><td>${row.cursorPublishedEnabled === "true" ? "On" : row.cursorPublishedEnabled === "false" ? "Off" : "Unknown"}</td><td>${date(row.storefront)}</td></tr>`).join("") || '<tr><td colspan="6">No activity recorded yet.</td></tr>'}</tbody></table></section><p><small>Times are UTC. Observed stores are not total installs. Records expire after 90 days without activity. Storefront loads indicate the cursor embed rendered on a desktop storefront; they do not prove the embed is enabled now or identify unique visitors. Missing signals can mean no desktop traffic, a blocker, an expired tracking link, or an unpublished update. Theme editor previews are excluded.</small></p></main></html>`;
    return new Response(html, {
      headers: {
        ...headers,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
      },
    });
  } catch {
    return new Response(
      "Activity storage unavailable. Check the server configuration and try again.",
      { status: 503, headers },
    );
  }
}
