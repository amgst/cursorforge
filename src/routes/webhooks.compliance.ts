import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookHmac } from "@/lib/shopify-admin";
import { deleteShopActivity } from "@/lib/activity.server";

// Shopify's mandatory privacy (compliance) webhooks, subscribed in shopify.app.toml.
// No customer data is stored. shop/redact also removes store-level activity.
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
        if (topic === "shop/redact") {
          const payload = JSON.parse(new TextDecoder().decode(body)) as { shop_domain?: string };
          await deleteShopActivity(payload.shop_domain ?? shop);
        }
        console.info(`Compliance webhook ${topic} for ${shop}: no customer data stored`);
        return new Response(null, { status: 200 });
      },
    },
  },
});
