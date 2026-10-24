import { render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { App } from './app';

/**
 * Smoke test for the whole showcase: rows must appear through the library's
 * own subscription, awaited with `findBy*` rather than flushed by hand.
 */
describe('demo-react', () => {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

  beforeAll(() => {
    // jsdom has no layout; give the tree viewport a height so rows virtualize in.
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains('tk-viewport') ? 560 : 0;
      },
    });
  });

  afterAll(() => {
    if (original) {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', original);
    }
  });

  it('renders the tree and its counters', async () => {
    const { container } = render(<App />);

    const rows = await screen.findAllByRole('treeitem');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.textContent).toContain('Group 000');
    expect(container.querySelector('.gauges')!.textContent).toContain('10,001');
  });
});
