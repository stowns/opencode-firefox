import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: resolve(__dirname, "dist/sidebar"),
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: resolve(__dirname, "sidebar.html"),
    },
  },
});
