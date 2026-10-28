// Minimal typings for the App Bridge global loaded in __root.tsx when running inside Shopify admin.
declare global {
  interface Window {
    shopify?: {
      idToken: () => Promise<string>;
      config?: { shop?: string };
      toast: {
        show: (message: string, options?: { isError?: boolean; duration?: number }) => void;
      };
      reviews?: {
        request: () => Promise<{ success: boolean; code: string; message: string }>;
      };
    };
  }
}

export function isEmbeddedInAdmin() {
  return typeof window !== "undefined" && typeof window.shopify?.idToken === "function";
}

/** The shop's myshopify.com domain, as reported by App Bridge. */
export function currentShopDomain() {
  return typeof window !== "undefined" ? window.shopify?.config?.shop : undefined;
}

/** Returns a fresh App Bridge session token for authenticating server functions. */
export async function getSessionToken() {
  if (!window.shopify) throw new Error("Open CursorForge from Shopify admin to publish.");
  return window.shopify.idToken();
}

let reviewRequested = false;

/**
 * Asks Shopify to show its native App Store review popup. Shopify decides whether it actually
 * appears (it skips shops that already reviewed and limits how often it shows), so this is safe
 * to call after any success. We only ask once per session and never block on the result.
 */
export function requestReview(delayMs = 2500) {
  if (reviewRequested || typeof window === "undefined" || !window.shopify?.reviews) return;
  reviewRequested = true;
  window.setTimeout(() => {
    window.shopify?.reviews?.request().catch(() => {});
  }, delayMs);
}

export function showToast(message: string, isError = false) {
  if (window.shopify?.toast) window.shopify.toast.show(message, { isError });
  else if (isError) console.error(message);
}
