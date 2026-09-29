import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { nitro } from "nitro/vite";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Serves the storefront trail engine to the editor as `virtual:cursorforge-trail`.
// Importing it by path would request `/extensions/...` in dev, which the `shopify app dev`
// proxy reserves for extension previews (it answers 404 and the editor fails to load).
function cursorTrailModule(): Plugin {
  const id = "virtual:cursorforge-trail";
  const resolvedId = `\0${id}`;
  const file = fileURLToPath(new URL("./extensions/cursor-embed/assets/cursorforge-trail.js", import.meta.url));
  return {
    name: "cursorforge-trail",
    resolveId: (source) => (source === id ? resolvedId : undefined),
    load(loadId) {
      if (loadId !== resolvedId) return undefined;
      this.addWatchFile(file);
      return readFileSync(file, "utf8");
    },
  };
}

// `shopify app dev` provides SHOPIFY_API_KEY (the public Client ID) and PORT.
// Expose the key to the client so App Bridge can load inside Shopify admin.
if (process.env["SHOPIFY_API_KEY"] && !process.env["VITE_SHOPIFY_API_KEY"]) {
  process.env["VITE_SHOPIFY_API_KEY"] = process.env["SHOPIFY_API_KEY"];
}
const port = Number(process.env["PORT"]);

export default defineConfig(({ command }) => ({
  optimizeDeps: {
    // Pre-bundle deps Vite otherwise discovers only after the page starts loading. Late discovery
    // triggers a re-optimize that breaks in-flight imports ("Failed to fetch dynamically imported
    // module"), which is especially common through the `shopify app dev` tunnel.
    include: [
      "@tanstack/router-core",
      "@tanstack/router-core/isServer",
      "@tanstack/router-core/ssr/client",
      "seroval",
    ],
  },
  server: {
    ...(port ? { port } : {}),
    // Allow the tunnel host that Shopify CLI creates for `shopify app dev`.
    allowedHosts: true,
  },
  plugins: [
    cursorTrailModule(),
    tailwindcss(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      server: { entry: "server" },
    }),
    command === "build" ? nitro() : null,
    viteReact(),
  ],
}));
