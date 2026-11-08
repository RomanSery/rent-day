import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // the Worker serves this folder as static assets (see worker/wrangler.jsonc)
    outDir: "build",
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    // forward the API and the game WebSocket to `wrangler dev`
    proxy: {
      "/api": "http://localhost:8787",
      "/ws": { target: "ws://localhost:8787", ws: true },
    },
  },
});
