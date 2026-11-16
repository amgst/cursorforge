import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  activityConfigured,
  storefrontActivityUrl,
  verifyActivityToken,
  handleActivityRequest,
  recordActivitySafely,
  deleteShopActivity,
} from "../src/lib/activity.server.ts";

const originalFetch = globalThis.fetch;
const names = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "ACTIVITY_PUBLIC_URL",
  "ACTIVITY_DASHBOARD_PASSWORD",
  "SHOPIFY_API_SECRET",
];
const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const name of names) {
    if (original[name] === undefined) delete process.env[name];
    else process.env[name] = original[name];
  }
});
function configure() {
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-only-token";
  process.env.ACTIVITY_PUBLIC_URL = "https://app.example";
  process.env.ACTIVITY_DASHBOARD_PASSWORD = "test-only-password";
  process.env.SHOPIFY_API_SECRET = "test-only-secret";
}
function ownerRequest() {
  return new Request("https://app.example/internal/activity", {
    headers: {
      Authorization: `Basic ${Buffer.from("admin:test-only-password").toString("base64")}`,
    },
  });
}

test("unconfigured tracking is disabled and dashboard fails closed", async () => {
  for (const name of names) delete process.env[name];
  assert.equal(activityConfigured(), false);
  assert.equal(storefrontActivityUrl("test.myshopify.com"), null);
  assert.equal((await handleActivityRequest(ownerRequest())).status, 503);
});

test("signed signals reject tampering, expiry and missing tokens", async () => {
  configure();
  const url = new URL(storefrontActivityUrl("test.myshopify.com"));
  const token = url.searchParams.get("token");
  assert.equal(verifyActivityToken(token), "test.myshopify.com");
  assert.equal(verifyActivityToken(token + "x"), null);
  const payload = Buffer.from("test.myshopify.com|1").toString("base64url");
  const signature = createHmac("sha256", process.env.SHOPIFY_API_SECRET)
    .update(`activity:${payload}`)
    .digest("base64url");
  assert.equal(verifyActivityToken(`${payload}.${signature}`), null);
  assert.equal(
    (await handleActivityRequest(new Request("https://app.example/api/activity/storefront")))
      .status,
    401,
  );
});

test("dashboard denies access before reading storage and escapes stored content", async () => {
  configure();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json(
      calls === 1
        ? [{ result: ["<script>bad</script>"] }]
        : [{ result: ["opened", String(Date.now()), "cursorPublishedEnabled", "true"] }],
    );
  };
  assert.equal(
    (await handleActivityRequest(new Request("https://app.example/internal/activity"))).status,
    401,
  );
  assert.equal(calls, 0);
  const response = await handleActivityRequest(ownerRequest());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const html = await response.text();
  assert.ok(html.includes("&lt;script&gt;bad&lt;/script&gt;"));
  assert.ok(!html.includes("<script>bad</script>"));
});

test("storefront writes contain only store-level fields and redact removes record and index", async () => {
  configure();
  const commands = [];
  globalThis.fetch = async (_url, options) => {
    const batch = JSON.parse(options.body);
    commands.push(...batch);
    return Response.json(batch.map(() => ({ result: 1 })));
  };
  const url = storefrontActivityUrl("test.myshopify.com");
  assert.equal((await handleActivityRequest(new Request(url))).status, 204);
  assert.equal(commands[0][0], "EVAL");
  assert.equal(commands[0][6], "storefront");
  assert.ok(!JSON.stringify(commands).includes("visitor"));
  await deleteShopActivity("test.myshopify.com");
  assert.deepEqual(commands.slice(-2), [
    [
      "DEL",
      "cursorforge:activity:test.myshopify.com",
      "cursorforge:activity:rate:test.myshopify.com",
    ],
    ["ZREM", "cursorforge:activity:shops", "test.myshopify.com"],
  ]);
});

test("storage failures keep editor usable and return retryable errors for collection and deletion", async () => {
  configure();
  globalThis.fetch = async () => Response.json([{ error: "unavailable" }]);
  await assert.doesNotReject(recordActivitySafely("test.myshopify.com", "opened"));
  assert.equal(
    (await handleActivityRequest(new Request(storefrontActivityUrl("test.myshopify.com")))).status,
    503,
  );
  await assert.rejects(deleteShopActivity("test.myshopify.com"));
});
