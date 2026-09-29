import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookHmac } from "@/lib/shopify-admin";

// Shopify's mandatory privacy (compliance) webhooks, subscribed in shopify.app.toml.
// CursorForge stores no customer data: the cursor design lives in an app-owned metafield that
// Shopify removes on uninstall, and uploaded images belong to the shop's own Files. So every
// topic only needs to be verified and acknowledged.
const COMPLIANCE_TOPICS = new Set(["customers/data_request", "customers/redact", "shop/redact"]);

export const Route = createFileRoute("/webhooks/compliance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.arrayBuffer();
        if (!(await verifyWebhookHmac(body, request.headers.get("x-shopify-hmac-sha256")))) {
          return new Response("Invalid HMAC", { status: 401 });
        }
        const topic = request.headers.get("x-shopify-topic") ?? "";
        const shop = request.headers.get("x-shopify-shop-domain") ?? "unknown shop";
        if (!COMPLIANCE_TOPICS.has(topic)) return new Response("Unsupported topic", { status: 400 });
        console.info(`Compliance webhook ${topic} for ${shop}: no customer data stored`);
        return new Response(null, { status: 200 });
      },
    },
  },
});
