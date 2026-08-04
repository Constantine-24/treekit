/**
 * Flat representation of a tree node for virtualized rendering.
 *
 * The flat list is the source of truth: nodes appear in depth-first order, and
 * each node links to its parent and children so hierarchy operations stay cheap
 * while rendering iterates a plain array.
 */
export interface TreeNode<T> {
  /** Unique, stable identifier. Used for DOM hit-testing (`data-node-id`) and reconciliation. */
  readonly id: string;
  /** The consumer's data payload for this node. */
  item: T;
  /** Display name; also the default `dataTransfer` text for drags. */
  name: string;
  /** Depth in the tree, root level = 0. Drives indentation. */
  level: number;
  /** Parent node, or `null` for roots. */
  parent: TreeNode<T> | null;
  /** Child nodes in display order. Absent or empty for leaves. */
  children?: TreeNode<T>[];
  /** Whether children are currently shown. */
  isExpanded?: boolean;
  /** Whether the node accepts `into` drops and renders as a folder. */
  isFolder?: boolean;
  /**
   * Whether the node can be expanded even when `children` is absent — the
   * lazy-loading signal. Expanding such a node emits a load request instead of
   * toggling in place.
   */
  expandable?: boolean;
  /** Whether a lazy children load is in flight (renders a busy indicator). */
  isLoading?: boolean;
  /** Whether this node may start a drag. Defaults to `true`. */
  canDrag?: boolean;
  /** Whether this node may be a drop target. Defaults to `true`. */
  canDrop?: boolean;
}

/**
 * Nested input shape consumed by `TreeState.setSource` and produced by
 * `TreeState.toHierarchy`. Consumers map their domain data into this shape;
 * the state builds the linked flat `TreeNode` structure from it.
 */
export interface TreeInput<T> {
  id: string;
  name: string;
  item: T;
  children?: TreeInput<T>[];
  isExpanded?: boolean;
  isFolder?: boolean;
  expandable?: boolean;
  canDrag?: boolean;
  canDrop?: boolean;
}

/** Where a drop lands relative to a reference node. */
export type DropMode = 'into' | 'before' | 'after';

/** The resolved landing spot of a drop. */
export interface DropTarget<T> {
  /** The node the drop resolved against. */
  node: TreeNode<T>;
  /** `into` drops as a child of `node`; `before`/`after` insert as a sibling. */
  mode: DropMode;
}

/**
 * Payload emitted when a drag is dropped over the tree — by pointer or by the
 * keyboard DnD mode.
 *
 * `target` is `null` when the drag is released over empty space.
 */
export interface DropEvent<T> {
  /**
   * The primary dragged node: the first of `nodes`, or `null` for an external
   * drop (where the consumer resolves its own payload, e.g. from
   * `dataTransfer`).
   *
   * Defined as *first in document order* rather than "the row the drag started
   * from", which is what keeps `node` a member of `nodes`: the origin row can
   * be de-nested away when an ancestor is dragged too, and a `node` outside
   * `nodes` would be a trap.
   */
  node: TreeNode<T> | null;
  /**
   * Every dragged node, normalized: document order, de-duplicated, de-nested
   * (no node whose ancestor is also present), and draggable. Empty for an
   * external drop.
   */
  nodes: readonly TreeNode<T>[];
  target: DropTarget<T> | null;
  /** The native transfer for external payloads; absent for keyboard drops. */
  dataTransfer?: DataTransfer | null;
}
