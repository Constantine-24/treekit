import { TestBed } from '@angular/core/testing';

import { App } from './app';

/**
 * Smoke test for the whole showcase. No manual change detection: the page must
 * render rows on scheduling alone, which is what catches a blank-render
 * regression (see .claude/rules/testing.md).
 */
describe('demo-angular', () => {
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
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const rows = Array.from(element.querySelectorAll<HTMLElement>('.tk-node'));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.textContent).toContain('Group 000');
    expect(element.querySelector('.gauges')!.textContent).toContain('10,001');
  });
});
