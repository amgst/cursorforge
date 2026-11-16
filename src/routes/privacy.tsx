import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

// Public privacy policy, linked from the Shopify App Store listing.
// Keep it in sync with what the app actually stores (see src/lib/cursor-config.functions.ts).
const LAST_UPDATED = "November 16, 2026";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [
    { title: "Privacy policy — CursorForge" },
    { name: "description", content: "How the CursorForge Shopify app handles store data." },
  ] }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return <main className="min-h-screen bg-workshop px-4 py-12 text-foreground">
    <article className="mx-auto max-w-2xl">
      <p className="font-mono text-[10px] uppercase text-muted-foreground">CursorForge · Shopify app</p>
      <h1 className="mt-2 text-3xl font-bold">Privacy policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>

      <Section title="Overview">
        CursorForge lets Shopify merchants design a custom mouse cursor and show it on their online store. This policy explains what information the app accesses when a merchant installs it, how that information is used, and where it is stored.
      </Section>

      <Section title="Information the app accesses">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Your store's domain</strong>, which Shopify provides when you open the app, so the app can connect to the right store.</li>
          <li><strong>Your cursor settings</strong>: shapes, colors, sizes, click points and trail options that you choose in the editor.</li>
          <li><strong>Cursor images you upload or draw</strong>. These are saved to your store's Files (Content → Files) with names starting with <code className="font-mono text-xs">cursorforge-</code>.</li>
        </ul>
        <p className="mt-3">The app requests the <code className="font-mono text-xs">read_files</code> and <code className="font-mono text-xs">write_files</code> permissions to list, save and delete cursor images.</p>
      </Section>

      <Section title="Information the app does not collect">
        CursorForge does not access or store customer information, orders, products, payment details or staff accounts. When activity measurement is configured, the desktop storefront embed sends a signed store-level signal that it loaded. This signal contains your store domain and an expiry time, with no visitor identifier, page URL, or cookies. Activity records contain only the store domain, first observed activity, latest app open, latest cursor publish, published cursor status, and latest storefront load. These records help us understand app adoption and troubleshoot setup; they do not measure unique visitors.
      </Section>

      <Section title="Where information is stored">
        <ul className="list-disc space-y-2 pl-5">
          <li>Your cursor settings are stored in your own Shopify store, in a data field that belongs to the app.</li>
          <li>Uploaded cursor images are stored in your store's Files.</li>
          <li>When configured, store-level activity is stored in Upstash Redis and deleted after 90 days without recorded activity. The private activity dashboard is restricted to the app operator. Shopify access tokens are held only briefly in server memory.</li>
          <li>The app is hosted on Vercel, which may keep standard request logs (such as IP address and time of request) under its own privacy policy.</li>
        </ul>
      </Section>

      <Section title="Sharing">
        We do not sell or rent your information. Vercel provides hosting and, when activity measurement is configured, Upstash provides activity storage. Hosting infrastructure may process standard request metadata, including IP addresses, even though our activity database does not store them.
      </Section>

      <Section title="Uninstalling and deleting data">
        When you uninstall CursorForge, Shopify removes the app's cursor settings from your store and the cursor no longer appears on your storefront. Cursor images you uploaded stay in your store's Files until you delete them, either from the app's My uploads panel or from Content → Files in your Shopify admin. The app stores no customer data. Store-level activity is deleted when Shopify sends its shop data deletion webhook, or expires after 90 days without activity.
      </Section>

      <Section title="Changes to this policy">
        If this policy changes, we will update this page and the date at the top.
      </Section>

      <Section title="Contact">
        Questions about this policy can be sent to the support contact listed on the CursorForge page in the Shopify App Store.
      </Section>
    </article>
  </main>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mt-8"><h2 className="text-lg font-semibold">{title}</h2><div className="mt-2 text-sm leading-relaxed text-foreground/85">{children}</div></section>;
}
