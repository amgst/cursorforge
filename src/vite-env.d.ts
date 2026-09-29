/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHOPIFY_STORE_DOMAIN?: string;
  readonly VITE_SHOPIFY_STOREFRONT_TOKEN?: string;
  readonly VITE_SHOPIFY_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Storefront trail engine, served by the cursorTrailModule plugin in vite.config.ts.
declare module "virtual:cursorforge-trail";
