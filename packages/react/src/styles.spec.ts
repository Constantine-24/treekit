import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Every `--tk-*` custom property a stylesheet reads or declares. */
function tokens(css: string): string[] {
  return [...new Set(css.match(/--tk-[a-z0-9-]+/g) ?? [])].sort();
}

/** Every `tk-*` class a stylesheet styles. */
function classes(css: string): string[] {
  return [...new Set(css.match(/\.tk-[a-z0-9-]+/g) ?? [])].sort();
}

/**
 * The two adapters promise the same theming surface. A token or class added to
 * one stylesheet and forgotten in the other would silently fork the public API.
 */
describe('default stylesheet parity with @treekit/angular', () => {
  const react = read('./tree.css');
  const angular = read('../../angular/projects/treekit/src/lib/tree.scss');

  it('uses the same --tk-* custom properties', () => {
    expect(tokens(react)).toEqual(tokens(angular));
  });

  it('styles the same tk-* classes', () => {
    // The Angular stylesheet targets the host through `:host`; React's host is `.tk-tree`.
    expect(classes(react).filter(name => name !== '.tk-tree')).toEqual(classes(angular));
  });
});
