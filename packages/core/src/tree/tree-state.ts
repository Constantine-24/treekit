import type { DropTarget, TreeInput, TreeNode } from './model';

/** Configuration for a `TreeState` instance. */
export interface TreeStateOptions<T> {
  /**
   * Called when an `expandable` node without loaded children is expanded.
   * The consumer loads the children and delivers them via `setChildren`.
   * When absent, expandable nodes expand in place like any folder.
   */
  onLoadChildren?: (node: TreeNode<T>) => void;
}

/** Returns whether `node` is inside the subtree rooted at `ancestor` (exclusive). */
export function isDescendant<T>(node: TreeNode<T>, ancestor: TreeNode<T>): boolean {
  let current = node.parent;
  while (current) {
    if (current === ancestor) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/**
 * Headless tree state: owns the forest, its flat depth-first projection, the
 * expansion/filter-driven visible list, and all structural mutations.
 *
 * Children arrays are the single source of order. After every structural
 * mutation the flat list is recomputed from the roots — O(n), which
 * virtualized rendering absorbs easily — so flat order, levels, and parent
 * links can never drift from the hierarchy. Node object references are stable
 * across recomputes; the arrays returned by `nodes()`/`visibleNodes()` get a
 * new identity on every change, which suits framework change detection.
 */
export class TreeState<T> {
  private readonly _options: TreeStateOptions<T>;
  private _roots: TreeNode<T>[] = [];
  private _flat: TreeNode<T>[] = [];
  private _visible: TreeNode<T>[] = [];
  private readonly _byId = new Map<string, TreeNode<T>>();
  private _filter: ((node: TreeNode<T>) => boolean) | null = null;
  /** Ids of filter matches plus their ancestors — the filtered universe. */
  private _filterKeepIds: Set<string> | null = null;
  /**
   * Ids of ancestors of matches only. These render force-expanded so their
   * matching descendants are reachable; matched nodes themselves keep their
   * real expansion state.
   */
  private _filterAncestorIds: Set<string> | null = null;
  /** Explicit collapses made while a filter is active; reset on filter change. */
  private readonly _collapsedDuringFilter = new Set<string>();
  private readonly _listeners = new Set<() => void>();

  constructor(options: TreeStateOptions<T> = {}) {
    this._options = options;
  }

  // MARK: - Reading

  /** All nodes in depth-first order. */
  nodes(): readonly TreeNode<T>[] {
    return this._flat;
  }

  /** Nodes currently visible given expansion state and the active filter. */
  visibleNodes(): readonly TreeNode<T>[] {
    return this._visible;
  }

  /** Root nodes of the forest. */
  roots(): readonly TreeNode<T>[] {
    return this._roots;
  }

  /** Looks a node up by its id. */
  findById(id: string): TreeNode<T> | undefined {
    return this._byId.get(id);
  }

  /**
   * Whether the node renders as expanded right now. While a filter is active,
   * revealed ancestors are expanded unless explicitly collapsed by the user.
   */
  isExpandedNow(node: TreeNode<T>): boolean {
    if (this._filterAncestorIds?.has(node.id)) {
      return !this._collapsedDuringFilter.has(node.id);
    }
    return !!node.isExpanded;
  }

  /** Subscribes to change notifications; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  // MARK: - Source

  /** Replaces the whole forest from nested input. */
  setSource(roots: TreeInput<T>[]): void {
    this._roots = roots.map(root => this._build(root, null));
    this._recompute();
    this._notify();
  }

  /** Serializes the forest back to nested inputs, reflecting all mutations. */
  toHierarchy(): TreeInput<T>[] {
    return this._roots.map(root => this._toInput(root));
  }

  // MARK: - Expansion

  /** Expands a node; triggers a lazy children load when applicable. */
  expand(node: TreeNode<T>): void {
    if (this._needsLazyLoad(node)) {
      if (!node.isLoading) {
        node.isLoading = true;
        this._options.onLoadChildren?.(node);
        this._notify();
      }
      return;
    }
    if (this._filterAncestorIds?.has(node.id)) {
      if (this._collapsedDuringFilter.delete(node.id)) {
        this._recompute();
        this._notify();
      }
      return;
    }
    if (!node.isExpanded) {
      node.isExpanded = true;
      this._recompute();
      this._notify();
    }
  }

  /** Collapses a node. */
  collapse(node: TreeNode<T>): void {
    if (this._filterAncestorIds?.has(node.id)) {
      if (!this._collapsedDuringFilter.has(node.id)) {
        this._collapsedDuringFilter.add(node.id);
        this._recompute();
        this._notify();
      }
      return;
    }
    if (node.isExpanded) {
      node.isExpanded = false;
      this._recompute();
      this._notify();
    }
  }

  /** Flips a node between expanded and collapsed. */
  toggle(node: TreeNode<T>): void {
    if (this.isExpandedNow(node)) {
      this.collapse(node);
    } else {
      this.expand(node);
    }
  }

  /** Expands every loaded folder. Does not trigger lazy loads. */
  expandAll(): void {
    for (const node of this._flat) {
      if (node.children?.length) {
        node.isExpanded = true;
      }
    }
    this._collapsedDuringFilter.clear();
    this._recompute();
    this._notify();
  }

  /** Collapses every node. */
  collapseAll(): void {
    for (const node of this._flat) {
      node.isExpanded = false;
    }
    this._collapsedDuringFilter.clear();
    this._recompute();
    this._notify();
  }

  // MARK: - Filter

  /**
   * Applies (or clears, with `null`) a filter predicate. The visible set
   * becomes matches plus their ancestors, ancestors shown expanded. Expansion
   * flags are never mutated, so clearing the filter restores the prior view.
   */
  setFilter(predicate: ((node: TreeNode<T>) => boolean) | null): void {
    this._filter = predicate;
    this._collapsedDuringFilter.clear();
    this._recompute();
    this._notify();
  }

  // MARK: - Mutations

  /** Whether `move(node, target)` would be accepted. Never mutates. */
  canMove(node: TreeNode<T>, target: DropTarget<T>): boolean {
    if (node === target.node || isDescendant(target.node, node)) {
      return false;
    }
    if (target.mode === 'into') {
      return !!target.node.isFolder && target.node.canDrop !== false;
    }
    const newParent = target.node.parent;
    return newParent === null || newParent.canDrop !== false;
  }

  /** Moves a node (with its subtree) to the target. Returns whether it happened. */
  move(node: TreeNode<T>, target: DropTarget<T>): boolean {
    if (!this.canMove(node, target)) {
      return false;
    }
    this._detach(node);
    this._insert(node, target);
    this._recompute();
    this._notify();
    return true;
  }

  /**
   * Adds a new node built from `input` at the target position, or appends it
   * to the roots when `target` is `null`. Returns the created node, or `null`
   * when the target cannot accept it.
   */
  add(input: TreeInput<T>, target: DropTarget<T> | null): TreeNode<T> | null {
    if (target?.mode === 'into' && (!target.node.isFolder || target.node.canDrop === false)) {
      return null;
    }
    const node = this._build(input, null);
    if (target === null) {
      node.parent = null;
      this._roots.push(node);
    } else {
      this._insert(node, target);
    }
    this._recompute();
    this._notify();
    return node;
  }

  /** Removes a node and its whole subtree. Returns whether it was found. */
  remove(node: TreeNode<T>): boolean {
    const siblings = node.parent ? node.parent.children : this._roots;
    const index = siblings ? siblings.indexOf(node) : -1;
    if (!siblings || index < 0) {
      return false;
    }
    siblings.splice(index, 1);
    this._recompute();
    this._notify();
    return true;
  }

  /** Delivers lazily loaded children for a node and expands it. */
  setChildren(node: TreeNode<T>, children: TreeInput<T>[]): void {
    node.children = children.map(child => this._build(child, node));
    node.isLoading = false;
    node.isExpanded = true;
    this._recompute();
    this._notify();
  }

  // MARK: - Internals

  private _needsLazyLoad(node: TreeNode<T>): boolean {
    return (
      !!node.expandable && !node.children?.length && this._options.onLoadChildren !== undefined
    );
  }

  private _build(input: TreeInput<T>, parent: TreeNode<T> | null): TreeNode<T> {
    const node: TreeNode<T> = {
      id: input.id,
      item: input.item,
      name: input.name,
      level: 0,
      parent,
      isExpanded: input.isExpanded ?? false,
      isFolder: input.isFolder,
      expandable: input.expandable,
      canDrag: input.canDrag,
      canDrop: input.canDrop,
    };
    if (input.children) {
      node.children = input.children.map(child => this._build(child, node));
    }
    return node;
  }

  private _toInput(node: TreeNode<T>): TreeInput<T> {
    const input: TreeInput<T> = { id: node.id, name: node.name, item: node.item };
    if (node.isExpanded) {
      input.isExpanded = true;
    }
    if (node.isFolder !== undefined) {
      input.isFolder = node.isFolder;
    }
    if (node.expandable !== undefined) {
      input.expandable = node.expandable;
    }
    if (node.canDrag !== undefined) {
      input.canDrag = node.canDrag;
    }
    if (node.canDrop !== undefined) {
      input.canDrop = node.canDrop;
    }
    if (node.children) {
      input.children = node.children.map(child => this._toInput(child));
    }
    return input;
  }

  private _detach(node: TreeNode<T>): void {
    const siblings = node.parent ? node.parent.children : this._roots;
    const index = siblings ? siblings.indexOf(node) : -1;
    if (siblings && index >= 0) {
      siblings.splice(index, 1);
    }
  }

  private _insert(node: TreeNode<T>, target: DropTarget<T>): void {
    if (target.mode === 'into') {
      target.node.children ??= [];
      target.node.children.push(node);
      node.parent = target.node;
      return;
    }
    const newParent = target.node.parent;
    const siblings = newParent ? (newParent.children ??= []) : this._roots;
    const referenceIndex = siblings.indexOf(target.node);
    const insertIndex = target.mode === 'before' ? referenceIndex : referenceIndex + 1;
    siblings.splice(insertIndex, 0, node);
    node.parent = newParent;
  }

  /** Rebuilds the flat list, id index, levels, filter universe, and visible list. */
  private _recompute(): void {
    this._flat = [];
    this._byId.clear();
    const walk = (node: TreeNode<T>, level: number): void => {
      node.level = level;
      this._flat.push(node);
      this._byId.set(node.id, node);
      for (const child of node.children ?? []) {
        child.parent = node;
        walk(child, level + 1);
      }
    };
    for (const root of this._roots) {
      root.parent = null;
      walk(root, 0);
    }

    this._computeFilterSets();
    this._visible = this._flat.filter(node => this._isVisible(node));
  }

  private _computeFilterSets(): void {
    if (!this._filter) {
      this._filterKeepIds = null;
      this._filterAncestorIds = null;
      return;
    }
    const keep = new Set<string>();
    const ancestors = new Set<string>();
    for (const node of this._flat) {
      if (this._filter(node)) {
        keep.add(node.id);
        let ancestor = node.parent;
        while (ancestor && !ancestors.has(ancestor.id)) {
          keep.add(ancestor.id);
          ancestors.add(ancestor.id);
          ancestor = ancestor.parent;
        }
      }
    }
    this._filterKeepIds = keep;
    this._filterAncestorIds = ancestors;
  }

  private _isVisible(node: TreeNode<T>): boolean {
    if (this._filterKeepIds) {
      if (!this._filterKeepIds.has(node.id)) {
        return false;
      }
      let ancestor = node.parent;
      while (ancestor) {
        if (this._collapsedDuringFilter.has(ancestor.id)) {
          return false;
        }
        ancestor = ancestor.parent;
      }
      return true;
    }
    let ancestor = node.parent;
    while (ancestor) {
      if (!ancestor.isExpanded) {
        return false;
      }
      ancestor = ancestor.parent;
    }
    return true;
  }

  private _notify(): void {
    for (const listener of this._listeners) {
      listener();
    }
  }
}
