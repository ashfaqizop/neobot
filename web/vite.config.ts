import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The dashboard is served by the Express backend in production (same origin, so
// the session cookie + Socket.IO "just work"). In dev, Vite serves the SPA and
// proxies the API + Socket.IO to the running backend (default port 3000) so the
// same-origin assumption holds while developing.
const BACKEND = process.env.VITE_BACKEND_ORIGIN ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/status.json': { target: BACKEND, changeOrigin: true },
      '/healthz': { target: BACKEND, changeOrigin: true },
      '/socket.io': { target: BACKEND, ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    // Keep the bundle lean; report anything unexpectedly large.
    chunkSizeWarningLimit: 900,
  },
});
