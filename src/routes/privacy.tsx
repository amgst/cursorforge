import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

// Public privacy policy, linked from the Shopify App Store listing.
// Keep it in sync with what the app actually stores (see src/lib/cursor-config.functions.ts).
const LAST_UPDATED = "September 29, 2026";

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
        <p className="mt-3">The app requests only the <code className="font-mono text-xs">write_files</code> permission, which it uses to save and delete those cursor images.</p>
      </Section>

      <Section title="Information the app does not collect">
        CursorForge does not access or store customer information, orders, products, payment details or staff accounts. The cursor shown on your storefront does not track visitors, set cookies, or send any data from your shoppers' browsers to us.
      </Section>

      <Section title="Where information is stored">
        <ul className="list-disc space-y-2 pl-5">
          <li>Your cursor settings are stored in your own Shopify store, in a data field that belongs to the app.</li>
          <li>Uploaded cursor images are stored in your store's Files.</li>
          <li>CursorForge does not run its own database. The access token Shopify issues for your store is held only briefly in server memory while the app handles your requests.</li>
          <li>The app is hosted on Vercel, which may keep standard request logs (such as IP address and time of request) under its own privacy policy.</li>
        </ul>
      </Section>

      <Section title="Sharing">
        We do not sell, rent or share your information with third parties, other than the hosting provider needed to run the app.
      </Section>

      <Section title="Uninstalling and deleting data">
        When you uninstall CursorForge, Shopify removes the app's cursor settings from your store and the cursor no longer appears on your storefront. Cursor images you uploaded stay in your store's Files until you delete them, either from the app's My uploads panel or from Content → Files in your Shopify admin. The app responds to Shopify's customer data and shop data deletion requests; because it stores no customer data, there is nothing further to return or remove.
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
