import type { TreeNode } from '../tree/model';
import type { TreeState } from '../tree/tree-state';

/** Configuration for a `SelectionModel`. */
export interface SelectionModelOptions<T> {
  /** The tree whose visible list defines ranges and resolves ids to nodes. */
  state: TreeState<T>;
  /** Fires whenever the selected id set actually changes. */
  onChange?: () => void;
}

/** Modifier keys accompanying a click, as `selectOn` interprets them. */
export interface SelectionModifiers {
  /** Ctrl on Windows/Linux, Cmd on macOS — toggles a single row. */
  ctrlOrMeta?: boolean;
  /** Extends the selection from the anchor to the clicked row. */
  shift?: boolean;
}

/**
 * Multi-selection over a `TreeState`, including the anchor tracking that range
 * selection needs.
 *
 * A separate layer rather than part of `TreeState` on purpose: selection is not
 * structural, and every `TreeState` mutator ends in an O(n) recompute plus a
 * notification. Moving a highlight must not pay that cost.
 *
 * Two rules are worth knowing before using it:
 *
 * - Selection is stored as **ids**, so it survives `setSource` and node churn.
 * - Selection is **explicit** — selecting a folder never implicitly selects its
 *   descendants. A move already relocates the whole subtree, so implying
 *   descendants would amount to asking to move them independently *and* inside
 *   their parent. Consumers that want the subtree can walk it themselves.
 */
export class SelectionModel<T> {
  private readonly _options: SelectionModelOptions<T>;
  private _ids = new Set<string>();
  private _anchorId: string | null = null;
  private _leadId: string | null = null;

  constructor(options: SelectionModelOptions<T>) {
    this._options = options;
  }

  // MARK: - Reading

  /**
   * Every selected id, including nodes currently hidden by collapse or filter —
   * so collapsing and re-expanding restores the highlight.
   */
  selectedIds(): ReadonlySet<string> {
    return this._ids;
  }

  /**
   * Selected nodes that are currently visible, in document order.
   *
   * Restricting to visible nodes is the single rule that stops an invisible
   * node riding along in a drag: select a row, collapse its parent, then drag
   * something else, and the hidden row stays put. `selectedIds` is the escape
   * hatch when the raw set is genuinely wanted.
   */
  selectedNodes(): readonly TreeNode<T>[] {
    return this._options.state.visibleNodes().filter(node => this._ids.has(node.id));
  }

  /** Whether the node is selected. */
  isSelected(node: TreeNode<T>): boolean {
    return this._ids.has(node.id);
  }

  /** Number of selected ids, hidden ones included. */
  size(): number {
    return this._ids.size;
  }

  /** The row that ranges extend from, or `null`. */
  anchorNode(): TreeNode<T> | null {
    return this._anchorId ? (this._options.state.findById(this._anchorId) ?? null) : null;
  }

  /** The most recently touched row, or `null`. */
  leadNode(): TreeNode<T> | null {
    return this._leadId ? (this._options.state.findById(this._leadId) ?? null) : null;
  }

  // MARK: - Writing

  /** Replaces the selection with a single node. */
  select(node: TreeNode<T>): boolean {
    this._anchorId = node.id;
    this._leadId = node.id;
    return this._commit(new Set([node.id]));
  }

  /**
   * Adds or removes a single node, moving the anchor onto it — so a following
   * shift-click extends from the row last ctrl-clicked, matching Finder,
   * Explorer and VS Code.
   */
  toggle(node: TreeNode<T>): boolean {
    const next = new Set(this._ids);
    if (!next.delete(node.id)) {
      next.add(node.id);
    }
    this._anchorId = node.id;
    this._leadId = node.id;
    return this._commit(next);
  }

  /**
   * Replaces the selection with the visible range from the anchor to `node`.
   * The anchor stays put, so successive shift-clicks grow and shrink a single
   * range rather than accumulating several.
   */
  selectRangeTo(node: TreeNode<T>): boolean {
    const range = this._range(node);
    this._leadId = node.id;
    if (!range) {
      return false;
    }
    return this._commit(new Set(range.map(candidate => candidate.id)));
  }

  /** Applies the click semantics for the given modifier keys. */
  selectOn(node: TreeNode<T>, modifiers: SelectionModifiers = {}): boolean {
    if (modifiers.shift) {
      return this.selectRangeTo(node);
    }
    if (modifiers.ctrlOrMeta) {
      return this.toggle(node);
    }
    return this.select(node);
  }

  /** Selects every currently visible node. */
  selectAllVisible(): boolean {
    const visible = this._options.state.visibleNodes();
    this._anchorId = visible[0]?.id ?? null;
    this._leadId = visible.at(-1)?.id ?? null;
    return this._commit(new Set(visible.map(node => node.id)));
  }

  /**
   * Replaces the selected ids wholesale, for consumers driving selection from
   * outside. A set-equal argument is a no-op and does not notify — required,
   * not merely an optimization, or a controlled input/output pair oscillates.
   */
  setIds(ids: Iterable<string>): boolean {
    return this._commit(new Set(ids));
  }

  /** Clears the selection and the anchor. */
  clear(): boolean {
    this._anchorId = null;
    this._leadId = null;
    return this._commit(new Set());
  }

  /**
   * Drops ids that no longer resolve to a node. Stale ids are already harmless
   * to `selectedNodes`, so this only matters when the raw set is serialized.
   */
  prune(): boolean {
    const state = this._options.state;
    if (this._anchorId && !state.findById(this._anchorId)) {
      this._anchorId = null;
    }
    if (this._leadId && !state.findById(this._leadId)) {
      this._leadId = null;
    }
    const next = new Set<string>();
    for (const id of this._ids) {
      if (state.findById(id)) {
        next.add(id);
      }
    }
    return this._commit(next);
  }

  // MARK: - Internals

  /**
   * The visible slice between the anchor and `node`. With no usable anchor,
   * `node` becomes the anchor, giving a single-row range.
   */
  private _range(node: TreeNode<T>): TreeNode<T>[] | null {
    const visible = this._options.state.visibleNodes();
    const toIndex = visible.indexOf(node);
    if (toIndex < 0) {
      return null;
    }
    let anchorIndex = this._anchorId
      ? visible.findIndex(candidate => candidate.id === this._anchorId)
      : -1;
    if (anchorIndex < 0) {
      anchorIndex = toIndex;
      this._anchorId = node.id;
    }
    return visible.slice(Math.min(anchorIndex, toIndex), Math.max(anchorIndex, toIndex) + 1);
  }

  /** Swaps in a new id set, notifying only when it actually differs. */
  private _commit(next: Set<string>): boolean {
    if (next.size === this._ids.size && [...next].every(id => this._ids.has(id))) {
      return false;
    }
    this._ids = next;
    this._options.onChange?.();
    return true;
  }
}
