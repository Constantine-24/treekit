import { copyFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', '@constantine-24/treekit-core'],
  // The component uses hooks and DOM refs, so it must be a client component under RSC.
  banner: { js: "'use client';" },
  // Shipped as-is (`@constantine-24/treekit-react/styles.css`); consumers import it once.
  onSuccess: async () => {
    copyFileSync('src/tree.css', 'dist/styles.css');
  },
});
