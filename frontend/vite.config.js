import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Proxy /api to the backend so localhost behaves like production (single
  // origin, first-party cookie). Without this the cross-site cookie bug is
  // invisible locally and only shows up after deploying.
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
