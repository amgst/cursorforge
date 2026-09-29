import { Check, ExternalLink, X } from "lucide-react";
import { useEffect, useState } from "react";
import { currentShopDomain } from "@/lib/app-bridge";

// Onboarding for the theme app extension (App Store requirement 5.1.3): merchants must turn on
// the "CursorForge cursor" app embed before the cursor shows on their storefront.
// The embed handle is the block's filename: extensions/cursor-embed/blocks/cursor.liquid.
const EMBED_HANDLE = "cursor";
const DISMISS_KEY = "cursorforge-setup-dismissed";

/**
 * Deep link that opens the theme editor's App embeds panel with CursorForge switched on (the merchant still clicks Save).
 * Format from https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration#app-embed-block-deep-linking
 */
function themeEditorEmbedLink(apiKey: string, shop: string | undefined) {
  const path = `/admin/themes/current/editor?context=apps&activateAppId=${apiKey}/${EMBED_HANDLE}`;
  return shop ? `https://${shop}${path}` : `shopify:/${path}`;
}

export function SetupGuide({ apiKey, embedded, published }: { apiKey: string | undefined; embedded: boolean; published: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  const [shop, setShop] = useState<string | undefined>();
  useEffect(() => {
    setShop(currentShopDomain());
    try { setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1"); } catch { /* storage unavailable: keep showing the guide */ }
  }, []);
  const dismiss = () => {
    setDismissed(true);
    try { window.localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  };
  if (dismissed) return <button type="button" onClick={() => { setDismissed(false); try { window.localStorage.removeItem(DISMISS_KEY); } catch { /* ignore */ } }} className="w-full border-b border-border bg-panel px-4 py-1.5 text-left font-mono text-[10px] uppercase text-muted-foreground hover:text-foreground">Show setup guide</button>;

  const steps = [
    { title: "Design your cursor", body: "Pick a shape and color, upload an image, or draw one. Use the Pointer, Text and Loading tabs for links, text fields and page loads.", done: true },
    { title: "Publish to store", body: "Click Publish to store to save your design to your shop.", done: published },
    { title: "Turn on the app embed", body: "In your theme editor, open App embeds, switch on CursorForge cursor, then click Save. You only need to do this once.", done: false },
  ];

  return <section aria-label="Setup guide" className="border-b border-border bg-panel px-4 py-3">
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase text-muted-foreground">Setup · show your cursor on your store</p>
        <ol className="mt-2 grid gap-2 md:grid-cols-3">{steps.map((step, index) => <li key={step.title} className="flex gap-2 rounded-md bg-panel-raised p-2.5">
          <span className={`grid size-5 shrink-0 place-items-center rounded-full font-mono text-[10px] font-bold ${step.done ? "bg-mint text-ink" : "bg-workshop text-muted-foreground ring-1 ring-border"}`}>{step.done ? <Check size={11}/> : index + 1}</span>
          <div className="min-w-0"><p className="text-sm font-semibold">{step.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{step.body}</p>
            {index === 2 ? embedded && apiKey ? <a href={themeEditorEmbedLink(apiKey, shop)} target="_top" className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-md bg-sun px-3 text-xs font-semibold text-ink hover:brightness-105">Turn on in theme<ExternalLink size={12}/></a> : <p className="mt-1 text-xs text-muted-foreground">Online Store → Themes → Customize → App embeds.</p> : null}
          </div>
        </li>)}</ol>
      </div>
      <button type="button" aria-label="Hide setup guide" onClick={dismiss} className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-panel-raised hover:text-foreground"><X size={14}/></button>
    </div>
  </section>;
}
