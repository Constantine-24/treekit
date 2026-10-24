#!/usr/bin/env node
/**
 * PostToolUse hook for Edit / Write.
 * Runs `npx prettier --write --ignore-unknown <path>` against the file just edited.
 * Never blocks — prettier errors are logged but the hook always exits 0.
 */

const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const FORMATTABLE = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.jsonc',
  '.html',
  '.scss',
  '.css',
  '.md',
  '.yaml',
  '.yml',
]);

let raw = '';
process.stdin.on('data', chunk => {
  raw += chunk;
});
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    process.exit(0);
  }

  const filePath = payload?.tool_input?.file_path;
  if (typeof filePath !== 'string' || !filePath) {
    process.exit(0);
  }

  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!existsSync(abs)) {
    process.exit(0);
  }

  const ext = path.extname(abs).toLowerCase();
  if (!FORMATTABLE.has(ext)) {
    process.exit(0);
  }

  const result = spawnSync(
    'npx',
    ['--no-install', 'prettier', '--write', '--ignore-unknown', abs],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'ignore', 'pipe'],
      encoding: 'utf8',
    }
  );

  if (result.status !== 0 && result.stderr) {
    process.stderr.write(`prettier-format hook: ${result.stderr.trim()}\n`);
  }

  process.exit(0);
});
