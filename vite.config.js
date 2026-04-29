import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_PORT = process.env.BACKEND_PORT || 3000;

export default defineConfig({
  // P7-001 — manifest.webmanifest + service-worker.js live under
  // client/public/ so they ship as unhashed root-level URLs.
  publicDir: path.resolve(__dirname, './client/public'),
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client'),
    },
  },
  server: {
    port: Number(process.env.VITE_PORT) || 5173,
    proxy: {
      '/socket.io': {
        target: `http://localhost:${BACKEND_PORT}`,
        ws: true,
        changeOrigin: true,
      },
      '/health': `http://localhost:${BACKEND_PORT}`,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
});
