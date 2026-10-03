import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import type { Plugin } from "vite";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

const isBuild = process.argv.includes("build");

const rawPort = process.env.PORT;

if (!rawPort && !isBuild) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = rawPort ? Number(rawPort) : 5173;

if (rawPort && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";
const reviewSource = path.resolve(import.meta.dirname, "../../.local/reviews/river-integration/source/artifacts/river-en-israel/src");
const activeSource = path.resolve(import.meta.dirname, "../river-en-israel/src/App.tsx");
const riverReviewResolver: Plugin = {
  name: "isolated-river-review-imports",
  enforce: "pre",
  transform(code, id) {
    if (!id.startsWith(reviewSource)) return;
    return code.replace(/(["'])@\//g, `$1${reviewSource}/`);
  },
  async resolveId(source, importer) {
    if (!(importer?.startsWith(reviewSource) || importer?.includes("/mockups/river-hebrew-review/")) || source.startsWith(".") || source.startsWith("/") || source.startsWith("@/")) return;
    return (await this.resolve(source, path.resolve(import.meta.dirname, "src/main.tsx"), { skipSelf: true }))
      ?? (await this.resolve(source, activeSource, { skipSelf: true }))
      ?? undefined;
  },
};

if (!process.env.BASE_PATH && !isBuild) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    mockupPreviewPlugin(),
    riverReviewResolver,
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
        ]
      : []),
  ],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      allow: [
        path.resolve(import.meta.dirname),
        reviewSource,
        path.resolve(import.meta.dirname, "../river-en-israel/node_modules"),
        path.resolve(import.meta.dirname, "../../node_modules/.pnpm"),
      ],
      deny: ["**/.env", "**/.env.*", "**/.git/**", "**/*.pem", "**/*.crt"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
