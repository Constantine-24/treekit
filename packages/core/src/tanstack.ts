import {
  elementScroll,
  measureElement,
  observeElementOffset,
  observeElementRect,
  Virtualizer,
} from '@tanstack/virtual-core';

import type { TreeVirtualizer, VirtualItem } from './virtualizer/virtualizer';

/** Configuration for the TanStack-backed virtualizer. */
export interface TanStackVirtualizerOptions {
  /** Estimated row height in pixels; refined by measurement per row. */
  estimateSize: (index: number) => number;
  /** Extra rows rendered above and below the visible range. Default 4. */
  overscan?: number;
}

/**
 * `TreeVirtualizer` backed by `@tanstack/virtual-core`, enabling variable /
 * measured row heights. Lives at the `@treekit/core/tanstack` subpath so the
 * dependency stays opt-in: `@tanstack/virtual-core` is an optional peer that
 * only consumers importing this module need to install.
 */
export class TanStackVirtualizer implements TreeVirtualizer {
  private readonly _options: TanStackVirtualizerOptions;
  private _count = 0;
  private _instance: Virtualizer<HTMLElement, HTMLElement> | null = null;

  constructor(options: TanStackVirtualizerOptions) {
    this._options = options;
  }

  attach(viewport: HTMLElement, onChange: () => void): () => void {
    const instance = new Virtualizer<HTMLElement, HTMLElement>({
      count: this._count,
      getScrollElement: () => viewport,
      estimateSize: this._options.estimateSize,
      overscan: this._options.overscan ?? 4,
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      measureElement,
      onChange: () => onChange(),
    });
    this._instance = instance;
    const unmount = instance._didMount();
    instance._willUpdate();
    return () => {
      unmount();
      this._instance = null;
    };
  }

  setCount(count: number): void {
    this._count = count;
    const instance = this._instance;
    if (instance) {
      instance.setOptions({ ...instance.options, count });
      instance.measure();
    }
  }

  totalSize(): number {
    return this._instance?.getTotalSize() ?? 0;
  }

  items(): readonly VirtualItem[] {
    return this._instance?.getVirtualItems() ?? [];
  }

  measure(element: HTMLElement, index: number): void {
    element.setAttribute('data-index', String(index));
    this._instance?.measureElement(element);
  }

  scrollToIndex(index: number): void {
    this._instance?.scrollToIndex(index);
  }
}
