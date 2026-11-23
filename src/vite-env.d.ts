/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHOPIFY_STORE_DOMAIN?: string;
  readonly VITE_SHOPIFY_STOREFRONT_TOKEN?: string;
  readonly VITE_SHOPIFY_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Storefront trail and effects engines, served by the storefrontAssetModules plugin in vite.config.ts.
declare module "virtual:cursorforge-trail";
declare module "virtual:cursorforge-effects";
