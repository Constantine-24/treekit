import type { TreeVirtualizer, VirtualItem } from './virtualizer';

/** Configuration for the built-in fixed-height virtualizer. */
export interface FixedHeightVirtualizerOptions {
  /** Height of every row in pixels. */
  rowHeight: number;
  /** Extra rows rendered above and below the visible range. Default 4. */
  overscan?: number;
}

/**
 * The zero-dependency virtualizer: every row has the same configurable
 * height, so the visible range is plain arithmetic over `scrollTop`. This is
 * the only place in the library allowed to derive geometry from
 * `index × rowHeight`.
 */
export class FixedHeightVirtualizer implements TreeVirtualizer {
  private _rowHeight: number;
  private readonly _overscan: number;
  private _count = 0;
  private _viewport: HTMLElement | null = null;
  private _onChange: (() => void) | null = null;
  private _detachListeners: (() => void) | null = null;
  private _items: VirtualItem[] = [];
  private _firstIndex = -1;
  private _lastIndex = -1;

  constructor(options: FixedHeightVirtualizerOptions) {
    this._rowHeight = options.rowHeight;
    this._overscan = options.overscan ?? 4;
  }

  attach(viewport: HTMLElement, onChange: () => void): () => void {
    this._viewport = viewport;
    this._onChange = onChange;

    const handleScroll = (): void => this._update(true);
    viewport.addEventListener('scroll', handleScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => this._update(true));
      resizeObserver.observe(viewport);
    }

    this._detachListeners = () => {
      viewport.removeEventListener('scroll', handleScroll);
      resizeObserver?.disconnect();
    };

    this._update(false);
    return () => this._detach();
  }

  setCount(count: number): void {
    if (count !== this._count) {
      this._count = count;
      this._update(true);
    }
  }

  /** Changes the row height (e.g. when the consumer switches row layouts). */
  setRowHeight(rowHeight: number): void {
    if (rowHeight !== this._rowHeight) {
      this._rowHeight = rowHeight;
      this._firstIndex = -1;
      this._update(true);
    }
  }

  totalSize(): number {
    return this._count * this._rowHeight;
  }

  items(): readonly VirtualItem[] {
    return this._items;
  }

  scrollToIndex(index: number): void {
    const viewport = this._viewport;
    if (!viewport) {
      return;
    }
    const start = index * this._rowHeight;
    const end = start + this._rowHeight;
    const viewTop = viewport.scrollTop;
    const viewBottom = viewTop + viewport.clientHeight;
    let top: number | null = null;
    if (start < viewTop) {
      top = start;
    } else if (end > viewBottom) {
      top = end - viewport.clientHeight;
    }
    if (top !== null) {
      if (typeof viewport.scrollTo === 'function') {
        viewport.scrollTo({ top });
      } else {
        viewport.scrollTop = top;
        this._update(true);
      }
    }
  }

  private _detach(): void {
    this._detachListeners?.();
    this._detachListeners = null;
    this._viewport = null;
    this._onChange = null;
  }

  /** Recomputes the rendered range; notifies when it actually changed. */
  private _update(notify: boolean): void {
    const viewport = this._viewport;
    if (!viewport) {
      return;
    }
    const scrollTop = viewport.scrollTop;
    const viewportHeight = viewport.clientHeight;
    let first = 0;
    let last = -1;
    if (this._count > 0 && this._rowHeight > 0) {
      first = Math.max(0, Math.floor(scrollTop / this._rowHeight) - this._overscan);
      const lastVisible = Math.ceil((scrollTop + viewportHeight) / this._rowHeight) - 1;
      last = Math.min(this._count - 1, lastVisible + this._overscan);
    }
    if (first === this._firstIndex && last === this._lastIndex) {
      return;
    }
    this._firstIndex = first;
    this._lastIndex = last;
    const items: VirtualItem[] = [];
    for (let index = first; index <= last; index++) {
      items.push({ index, start: index * this._rowHeight, size: this._rowHeight });
    }
    this._items = items;
    if (notify) {
      this._onChange?.();
    }
  }
}
