/** One positioned row slot produced by a virtualizer. */
export interface VirtualItem {
  /** Index into the visible-nodes list. */
  readonly index: number;
  /** Offset from the top of the virtual content, in pixels. */
  readonly start: number;
  /** Row height in pixels. */
  readonly size: number;
}

/**
 * Contract between the tree and a virtualization strategy.
 *
 * The interface is shaped for the variable-height superset: all row geometry
 * (positioning, insertion lines, auto-scroll math) must flow through
 * `items()`' `start`/`size` — never `index × rowHeight` — so implementations
 * with measured rows work without any consumer change. The built-in
 * `FixedHeightVirtualizer` is dependency-free; `@treekit/core/tanstack`
 * provides measured rows via the optional `@tanstack/virtual-core` peer.
 */
export interface TreeVirtualizer {
  /**
   * Binds the virtualizer to its scroll viewport. `onChange` fires whenever
   * the computed items change (scroll, resize, count change). Returns the
   * detach function; after detaching the instance may be attached again.
   */
  attach(viewport: HTMLElement, onChange: () => void): () => void;

  /** Sets the number of rows being virtualized. */
  setCount(count: number): void;

  /** Total height of the virtual content in pixels. */
  totalSize(): number;

  /** The row slots to render right now (visible range plus overscan). */
  items(): readonly VirtualItem[];

  /** Reports a rendered row element for measurement (variable-height only). */
  measure?(element: HTMLElement, index: number): void;

  /** Scrolls the viewport so the row at `index` becomes visible. */
  scrollToIndex?(index: number): void;
}
