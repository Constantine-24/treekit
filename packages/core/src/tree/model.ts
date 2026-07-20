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
 * `node` is the dragged tree node for an in-tree move, or `null` for an
 * external drop (the consumer resolves its own payload, e.g. from
 * `dataTransfer`). `target` is `null` when released over empty space.
 */
export interface DropEvent<T> {
  node: TreeNode<T> | null;
  target: DropTarget<T> | null;
  /** The native transfer for external payloads; absent for keyboard drops. */
  dataTransfer?: DataTransfer | null;
}
