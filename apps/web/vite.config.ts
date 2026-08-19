import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  envDir: "../..",
  build: {
    target: "esnext",
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      // Proxea /api/* a la worker — sólo para llamadas fetch desde el SPA.
      // El redirect OAuth NO usa proxy: el navegador va entero a la URL de la API.
      "/api": {
        target: process.env.VITE_API_URL ?? "http://127.0.0.1:8787",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, "/api"),
      },
    },
  },
});
