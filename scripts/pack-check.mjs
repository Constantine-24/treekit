#!/usr/bin/env node
/**
 * Packs every publishable package exactly as `pnpm publish` would (honouring
 * `publishConfig.directory` for @treekit/angular) and checks each tarball:
 * required files present, no sources or specs, and no `workspace:` specifier
 * left in the packed package.json. Run after `pnpm build`.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PACKAGES = [
  {
    dir: 'packages/core',
    required: ['dist/index.js', 'dist/index.cjs', 'dist/index.d.ts', 'dist/tanstack.js'],
  },
  {
    dir: 'packages/react',
    required: ['dist/index.js', 'dist/index.cjs', 'dist/index.d.ts', 'dist/styles.css'],
  },
  {
    dir: 'packages/angular/projects/treekit',
    required: ['fesm2022/treekit-angular.mjs', 'types/treekit-angular.d.ts'],
  },
];
const ALWAYS = ['package.json', 'README.md', 'LICENSE'];
const FORBIDDEN = [/^src\//, /\.spec\./, /^tsconfig/, /CLAUDE\.md$/];

const destination = mkdtempSync(join(tmpdir(), 'treekit-pack-'));
let failures = 0;

try {
  for (const pkg of PACKAGES) {
    const output = execFileSync('pnpm', ['pack', '--json', '--pack-destination', destination], {
      cwd: pkg.dir,
      encoding: 'utf8',
    });
    const { name, version, filename, files } = JSON.parse(output);
    const paths = files.map(file => file.path);
    const problems = [];

    for (const required of [...ALWAYS, ...pkg.required]) {
      if (!paths.includes(required)) problems.push(`missing ${required}`);
    }
    for (const path of paths) {
      if (FORBIDDEN.some(pattern => pattern.test(path))) problems.push(`should not ship ${path}`);
    }
    const manifest = execFileSync('tar', ['-xOf', filename, 'package/package.json'], {
      encoding: 'utf8',
    });
    for (const [field, deps] of Object.entries(JSON.parse(manifest))) {
      if (!field.toLowerCase().includes('dependencies') || typeof deps !== 'object') continue;
      for (const [dep, range] of Object.entries(deps)) {
        if (String(range).startsWith('workspace:'))
          problems.push(`${field}.${dep} is still "${range}"`);
      }
    }

    console.log(`${problems.length ? '✗' : '✓'} ${name}@${version} — ${paths.length} files`);
    for (const path of paths.sort()) console.log(`    ${path}`);
    for (const problem of problems) console.error(`    ✗ ${problem}`);
    failures += problems.length;
  }
} finally {
  rmSync(destination, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\npack:check found ${failures} problem(s).`);
  process.exit(1);
}
