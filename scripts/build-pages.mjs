#!/usr/bin/env node
/**
 * Assembles the GitHub Pages site into `_site/`:
 *
 *   /          apps/site          (Vite, BASE_PATH)
 *   /react/    apps/demo-react    (Vite, BASE_PATH)
 *   /angular/  apps/demo-angular  (Angular CLI, --base-href)
 *
 * All three are source-linked, so no package build is needed first. The base
 * defaults to the project-site path `/treekit/`; override with PAGES_BASE.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '_site');
const base = (process.env.PAGES_BASE ?? '/treekit/').replace(/\/?$/, '/');

const run = (args, options = {}) =>
  execFileSync('pnpm', args, { cwd: root, stdio: 'inherit', ...options });

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const [app, path] of [
  ['site', ''],
  ['demo-react', 'react/'],
]) {
  run(['--filter', app, 'exec', 'vite', 'build', '--outDir', resolve(out, path), '--emptyOutDir'], {
    env: { ...process.env, BASE_PATH: `${base}${path}` },
  });
}

const angularOut = resolve(root, 'apps/demo-angular/dist/pages');
run([
  '--filter',
  'demo-angular',
  'exec',
  'ng',
  'build',
  '--base-href',
  `${base}angular/`,
  '--output-path',
  angularOut,
]);
cpSync(resolve(angularOut, 'browser'), resolve(out, 'angular'), { recursive: true });
rmSync(angularOut, { recursive: true, force: true });

console.log(`\nPages site assembled in _site/ for base ${base}`);
