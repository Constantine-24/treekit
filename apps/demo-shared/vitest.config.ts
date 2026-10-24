import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@treekit/core/tanstack',
        replacement: source('../../packages/core/src/tanstack.ts'),
      },
      { find: '@treekit/core', replacement: source('../../packages/core/src/index.ts') },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
  },
});
