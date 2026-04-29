import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tests live alongside their target file as `*.test.js` (or in `tests/`).
// We split node-vs-DOM environments by file path: anything under `client/` or
// `tests/client/` runs in jsdom; everything else runs in node.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    environmentMatchGlobs: [
      ['client/**', 'jsdom'],
      ['tests/client/**', 'jsdom'],
    ],
    include: ['**/*.test.js', 'tests/**/*.test.js'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'TRELLIS-main/**',
      '.runpod/**',
      'deploy/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['server/**/*.js', 'client/**/*.js'],
      exclude: ['**/*.test.js', 'client/main.js'],
    },
  },
});
