import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: resolve(__dirname, "dist"),
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
