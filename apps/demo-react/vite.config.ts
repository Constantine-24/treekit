import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const source = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // Pages serves this app under /treekit/react/ (`pnpm build:pages`); locally it is at /.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  resolve: {
    // Source-linked: the libraries resolve to their sources, never to dist/ or node_modules.
    alias: [
      {
        find: /^@constantine-24\/treekit-core$/,
        replacement: source('../../packages/core/src/index.ts'),
      },
      {
        find: /^@constantine-24\/treekit-core\/tanstack$/,
        replacement: source('../../packages/core/src/tanstack.ts'),
      },
      {
        find: /^@constantine-24\/treekit-react$/,
        replacement: source('../../packages/react/src/index.ts'),
      },
      {
        find: /^@constantine-24\/treekit-react\/styles\.css$/,
        replacement: source('../../packages/react/src/tree.css'),
      },
      { find: /^demo-shared$/, replacement: source('../demo-shared/src/index.ts') },
      { find: /^demo-shared\/(.*)$/, replacement: source('../demo-shared/src/$1') },
    ],
  },
  // Backstop against Vite serving a stale pre-bundled copy (apps/CLAUDE.md).
  optimizeDeps: { exclude: ['@constantine-24/treekit-core', '@constantine-24/treekit-react'] },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.tsx'],
    setupFiles: ['src/test-setup.ts'],
  },
});
