import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { App } from './app';

describe('site', () => {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

  beforeAll(() => {
    // jsdom has no layout; give the tree viewport a height so rows virtualize in.
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains('tk-viewport') ? 400 : 0;
      },
    });
  });

  afterAll(() => {
    if (original) {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', original);
    }
  });

  it('renders the live tree', async () => {
    render(<App />);

    const rows = await screen.findAllByRole('treeitem');
    expect(rows[0]!.textContent).toContain('Group 000');
  });

  it('switches the quick-start tabs with the arrow keys', () => {
    render(<App />);
    const react = screen.getByRole('tab', { name: 'React' });
    expect(react.getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(react, { key: 'ArrowRight' });

    expect(screen.getByRole('tab', { name: 'Angular' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toContain('@treekit/angular');
  });
});
