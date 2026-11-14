import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Production builds need the real Turnstile site key (see README, deploy).
  // Without it the sign-up form falls back to the test key, and the
  // production Worker refuses test-key tokens, so nobody could sign up.
  if (command === "build" && mode === "production" && !loadEnv(mode, ".").VITE_TURNSTILE_SITE_KEY) {
    console.warn(
      "\n⚠ VITE_TURNSTILE_SITE_KEY is not set: this build uses Turnstile's test key, so sign-up will be refused in production.\n" +
        "  Put it in .env.production.local or the build environment before deploying.\n"
    );
  }

  return {
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
  };
});
