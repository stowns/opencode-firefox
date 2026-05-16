import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { readdirSync } from "fs";

const browser = process.env.BROWSER || "firefox";
const outDir = resolve(__dirname, `dist/${browser}`);

function copyDir(src, dest) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = resolve(src, entry);
    const destPath = resolve(dest, entry);
    copyFileSync(srcPath, destPath);
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-assets",
      closeBundle() {
        const manifestName = `manifest.${browser}.json`;
        const manifestSrc = resolve(__dirname, manifestName);
        if (existsSync(manifestSrc)) {
          copyFileSync(manifestSrc, resolve(outDir, "manifest.json"));
        } else {
          console.warn(`Manifest not found: ${manifestName}`);
        }

        const iconsSrc = resolve(__dirname, "icons");
        const iconsDest = resolve(outDir, "icons");
        if (existsSync(iconsSrc)) {
          copyDir(iconsSrc, iconsDest);
        } else {
          console.warn("Icons directory not found");
        }
      },
    },
  ],
  base: "./",
  build: {
    outDir,
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: {
        sidebar: resolve(__dirname, "sidebar.html"),
        background: resolve(__dirname, "src/background/index.ts"),
        "content/extract": resolve(__dirname, "src/content/extract.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
