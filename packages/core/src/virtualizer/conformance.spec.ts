import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TanStackVirtualizer } from '../tanstack';
import { FixedHeightVirtualizer } from './fixed-height-virtualizer';
import type { TreeVirtualizer } from './virtualizer';

const ROW_HEIGHT = 30;
const OVERSCAN = 2;
const VIEWPORT_HEIGHT = 300;
const COUNT = 100;

/** Minimal ResizeObserver that reports the element's mocked rect once on observe. */
class ResizeObserverStub {
  constructor(private readonly _callback: ResizeObserverCallback) {}

  observe(target: Element): void {
    const entry = {
      target,
      contentRect: target.getBoundingClientRect(),
    } as unknown as ResizeObserverEntry;
    this._callback([entry], this as unknown as ResizeObserver);
  }

  unobserve(): void {}

  disconnect(): void {}
}

/** Creates a scroll viewport with mocked geometry and a working scrollTo. */
function createViewport(height = VIEWPORT_HEIGHT): HTMLElement {
  const element = document.createElement('div');
  Object.defineProperty(element, 'clientHeight', { value: height, configurable: true });
  Object.defineProperty(element, 'offsetHeight', { value: height, configurable: true });
  Object.defineProperty(element, 'offsetWidth', { value: 200, configurable: true });
  Object.defineProperty(element, 'scrollHeight', {
    value: COUNT * ROW_HEIGHT,
    configurable: true,
  });
  element.getBoundingClientRect = () =>
    ({
      width: 200,
      height,
      top: 0,
      left: 0,
      right: 200,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  element.scrollTo = ((options: ScrollToOptions) => {
    element.scrollTop = options.top ?? 0;
    element.dispatchEvent(new Event('scroll'));
  }) as typeof element.scrollTo;
  document.body.appendChild(element);
  return element;
}

function scrollViewport(element: HTMLElement, top: number): void {
  element.scrollTop = top;
  element.dispatchEvent(new Event('scroll'));
}

const implementations = [
  {
    name: 'FixedHeightVirtualizer',
    create: (): TreeVirtualizer =>
      new FixedHeightVirtualizer({ rowHeight: ROW_HEIGHT, overscan: OVERSCAN }),
  },
  {
    name: 'TanStackVirtualizer',
    create: (): TreeVirtualizer =>
      new TanStackVirtualizer({ estimateSize: () => ROW_HEIGHT, overscan: OVERSCAN }),
  },
];

describe.each(implementations)('$name conformance', ({ create }) => {
  let viewport: HTMLElement;
  let virtualizer: TreeVirtualizer;
  let detach: () => void;
  let changeCount: number;

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    viewport = createViewport();
    virtualizer = create();
    virtualizer.setCount(COUNT);
    changeCount = 0;
    detach = virtualizer.attach(viewport, () => changeCount++);
  });

  afterEach(() => {
    detach();
    viewport.remove();
    vi.unstubAllGlobals();
  });

  it('reports the total size of all rows', () => {
    expect(virtualizer.totalSize()).toBe(COUNT * ROW_HEIGHT);
  });

  it('renders contiguous fixed-size slots from the top when unscrolled', () => {
    const items = virtualizer.items();
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]!.index).toBe(0);
    for (const item of items) {
      expect(item.start).toBe(item.index * ROW_HEIGHT);
      expect(item.size).toBe(ROW_HEIGHT);
    }
    const last = items.at(-1)!;
    expect(last.start + last.size).toBeGreaterThanOrEqual(VIEWPORT_HEIGHT);
  });

  it('covers every fully visible row after scrolling, within a bounded window', () => {
    scrollViewport(viewport, 900);
    const indices = virtualizer.items().map(item => item.index);
    for (let row = 30; row < 40; row++) {
      expect(indices).toContain(row);
    }
    expect(indices.length).toBeLessThanOrEqual(10 + 2 * OVERSCAN + 2);
    expect(Math.min(...indices)).toBeGreaterThanOrEqual(30 - OVERSCAN - 1);
  });

  it('fires onChange when scrolling shifts the range', () => {
    const baseline = changeCount;
    scrollViewport(viewport, 1500);
    expect(changeCount).toBeGreaterThan(baseline);
  });

  it('fires onChange when the count grows below the visible range', () => {
    const baseline = changeCount;
    virtualizer.setCount(COUNT * 2);
    expect(changeCount).toBeGreaterThan(baseline);
    expect(virtualizer.totalSize()).toBe(COUNT * 2 * ROW_HEIGHT);
  });

  it('clamps items and total size when the count shrinks', () => {
    virtualizer.setCount(5);
    expect(virtualizer.totalSize()).toBe(5 * ROW_HEIGHT);
    const indices = virtualizer.items().map(item => item.index);
    expect(Math.max(...indices)).toBeLessThanOrEqual(4);
  });

  it('scrollToIndex brings a far row into view', () => {
    virtualizer.scrollToIndex?.(50);
    expect(viewport.scrollTop).toBeGreaterThan(0);
    const indices = virtualizer.items().map(item => item.index);
    expect(indices).toContain(50);
  });

  it('stops notifying after detach', () => {
    detach();
    const baseline = changeCount;
    scrollViewport(viewport, 2100);
    expect(changeCount).toBe(baseline);
  });
});
