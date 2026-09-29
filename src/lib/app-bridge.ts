// Minimal typings for the App Bridge global loaded in __root.tsx when running inside Shopify admin.
declare global {
  interface Window {
    shopify?: {
      idToken: () => Promise<string>;
      toast: {
        show: (message: string, options?: { isError?: boolean; duration?: number }) => void;
      };
    };
  }
}

export function isEmbeddedInAdmin() {
  return typeof window !== "undefined" && typeof window.shopify?.idToken === "function";
}

/** Returns a fresh App Bridge session token for authenticating server functions. */
export async function getSessionToken() {
  if (!window.shopify) throw new Error("Open CursorForge from Shopify admin to publish.");
  return window.shopify.idToken();
}

export function showToast(message: string, isError = false) {
  if (window.shopify?.toast) window.shopify.toast.show(message, { isError });
  else if (isError) console.error(message);
}
