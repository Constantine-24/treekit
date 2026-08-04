import type { DropEvent, DropTarget, TreeNode } from '../tree/model';
import type { SelectionModel } from '../selection/selection-model';
import { isDescendantOfAny, normalizeDragNodes, TreeState } from '../tree/tree-state';

/** Announcement texts for the keyboard DnD mode; override for localization. */
export interface KeyboardMessages<T> {
  grabbed: (nodes: readonly TreeNode<T>[]) => string;
  moved: (target: DropTarget<T>) => string;
  dropped: (nodes: readonly TreeNode<T>[], target: DropTarget<T>) => string;
  cancelled: (nodes: readonly TreeNode<T>[]) => string;
  /** Announced when Space toggles a row or Ctrl/Cmd+A selects everything. */
  selectionChanged: (count: number) => string;
}

/** Names a payload for announcements: the node's own name, or a count. */
function label<T>(nodes: readonly TreeNode<T>[]): string {
  return nodes.length === 1 ? nodes[0]!.name : `${nodes.length} items`;
}

function defaultMessages<T>(): KeyboardMessages<T> {
  return {
    grabbed: nodes =>
      `${label(nodes)} grabbed. Use arrow keys to choose a position, Space to drop, Escape to cancel.`,
    moved: target =>
      target.mode === 'into'
        ? `Into ${target.node.name}`
        : `${target.mode === 'before' ? 'Before' : 'After'} ${target.node.name}`,
    dropped: (nodes, target) =>
      target.mode === 'into'
        ? `${label(nodes)} dropped into ${target.node.name}.`
        : `${label(nodes)} dropped ${target.mode} ${target.node.name}.`,
    cancelled: nodes => `Move of ${label(nodes)} cancelled.`,
    selectionChanged: count => {
      if (count === 0) {
        return 'Selection cleared.';
      }
      return count === 1 ? '1 item selected.' : `${count} items selected.`;
    },
  };
}

/** Configuration for a `KeyboardController`. */
export interface KeyboardControllerOptions<T> {
  /** The tree state to navigate and mutate-preview against. */
  state: TreeState<T>;
  /** Receives keyboard drops — the same contract as the pointer `DndEngine`. */
  onDrop: (event: DropEvent<T>) => void;
  /** Validation hook for drop positions — wire `TreeState.canMoveMany` here. */
  canDropAt?: (nodes: readonly TreeNode<T>[], target: DropTarget<T>) => boolean;
  /** Disables grabbing while it returns `true`. */
  isDisabled?: () => boolean;
  /** Fires when active row, grab state, or drop preview change. */
  onStateChange?: () => void;
  /** Receives live-region announcements for screen readers. */
  announce?: (message: string) => void;
  /** Keeps the active/previewed row scrolled into view (visible-list index). */
  scrollToIndex?: (index: number) => void;
  /**
   * Selection model driving the multi-select keys. Wiring one changes `Space`
   * from "grab" to "toggle selection" and moves grabbing to `Ctrl/Cmd+Space`;
   * omit it and the keyboard behaves exactly as it does single-select.
   */
  selection?: SelectionModel<T>;
  /**
   * Gates the selection keys at runtime without re-wiring the controller.
   * Defaults to enabled whenever `selection` is present.
   */
  isMultiSelectEnabled?: () => boolean;
  /** Announcement text overrides. */
  messages?: Partial<KeyboardMessages<T>>;
}

/**
 * Headless keyboard layer: ARIA tree navigation (roving tabindex, arrow keys,
 * Home/End, expand/collapse) plus an accessible drag-and-drop mode. Arrows step
 * a drop preview through the same into/before/after positions the pointer
 * engine resolves, and dropping emits an identical `DropEvent`. This is the
 * supported DnD path for touch devices and assistive technology, since native
 * HTML5 drag does not fire from touch gestures on all platforms.
 *
 * The grab key depends on whether a `selection` is wired:
 *
 * | Key             | No selection wired | Selection wired            |
 * | --------------- | ------------------ | -------------------------- |
 * | `Space`         | grab               | toggle selection           |
 * | `Ctrl/Cmd+Space`| grab               | grab                       |
 * | `Shift+Arrows`  | move active        | extend the selection range |
 * | `Ctrl/Cmd+A`    | (unhandled)        | select all visible         |
 *
 * `Space` had to give way because it is the conventional selection toggle, and
 * every unambiguous alternative grab chord collides with a browser or OS
 * shortcut. The only casualty is APG's `Ctrl+Space`, which APG itself describes
 * as a redundant alias for `Space`.
 */
export class KeyboardController<T> {
  private readonly _options: KeyboardControllerOptions<T>;
  private readonly _messages: KeyboardMessages<T>;
  private _activeId: string | null = null;
  private _grabbed: TreeNode<T>[] = [];
  private _grabbedSet = new Set<TreeNode<T>>();
  private _preview: DropTarget<T> | null = null;

  constructor(options: KeyboardControllerOptions<T>) {
    this._options = options;
    this._messages = { ...defaultMessages<T>(), ...options.messages };
  }

  // MARK: - State

  /** The row owning the roving tabindex. Falls back to the first visible node. */
  activeNode(): TreeNode<T> | null {
    const visible = this._options.state.visibleNodes();
    if (this._activeId) {
      const active = visible.find(node => node.id === this._activeId);
      if (active) {
        return active;
      }
    }
    return visible[0] ?? null;
  }

  /** First node grabbed for a keyboard move, or `null` while idle. */
  grabbedNode(): TreeNode<T> | null {
    return this._grabbed[0] ?? null;
  }

  /** Every node grabbed for a keyboard move; empty while idle. */
  grabbedNodes(): readonly TreeNode<T>[] {
    return this._grabbed;
  }

  /** The currently previewed drop position while grabbed, or `null`. */
  dropPreview(): DropTarget<T> | null {
    return this._preview;
  }

  /** Sets the active row (e.g. from a pointer click on a row). */
  setActive(node: TreeNode<T>): void {
    if (this._activeId !== node.id) {
      this._activeId = node.id;
      this._notify();
    }
  }

  /** Roving tabindex value for a row. */
  tabIndexFor(node: TreeNode<T>): 0 | -1 {
    return this.activeNode() === node ? 0 : -1;
  }

  /** ARIA attributes for a row element (`role=tree` goes on the container). */
  rowAria(node: TreeNode<T>): Record<string, string | number | boolean> {
    const aria: Record<string, string | number | boolean> = {
      role: 'treeitem',
      'aria-level': node.level + 1,
    };
    if (node.isFolder || node.expandable) {
      aria['aria-expanded'] = this._options.state.isExpandedNow(node);
    }
    return aria;
  }

  // MARK: - Key handling

  /** Processes a keydown; returns whether it was handled (call preventDefault then). */
  handleKeyDown(event: KeyboardEvent): boolean {
    if (this._grabbed.length > 0) {
      return this._handleGrabbedKey(event.key);
    }
    return this._handleNavigationKey(event);
  }

  private _handleNavigationKey(event: KeyboardEvent): boolean {
    const state = this._options.state;
    const visible = state.visibleNodes();
    const active = this.activeNode();
    if (!active || visible.length === 0) {
      return false;
    }
    const index = visible.indexOf(active);
    const ctrlOrMeta = event.ctrlKey || event.metaKey;
    const extend = event.shiftKey;

    switch (event.key) {
      case 'ArrowDown':
        this._moveActive(Math.min(visible.length - 1, index + 1), extend);
        return true;
      case 'ArrowUp':
        this._moveActive(Math.max(0, index - 1), extend);
        return true;
      case 'Home':
        this._moveActive(0, extend);
        return true;
      case 'End':
        this._moveActive(visible.length - 1, extend);
        return true;
      case 'ArrowRight':
        if (this._isExpandableFolder(active) && !state.isExpandedNow(active)) {
          state.expand(active);
        } else if (state.isExpandedNow(active) && this._hasVisibleChildren(active)) {
          this._moveActive(index + 1);
        }
        return true;
      case 'ArrowLeft':
        if (this._isExpandableFolder(active) && state.isExpandedNow(active)) {
          state.collapse(active);
        } else if (active.parent) {
          const parentIndex = visible.indexOf(active.parent);
          if (parentIndex >= 0) {
            this._moveActive(parentIndex);
          }
        }
        return true;
      case 'a':
      case 'A':
        if (ctrlOrMeta && this._isMultiSelect()) {
          this._selectAllVisible();
          return true;
        }
        return false;
      case ' ':
        // With a selection wired, Space toggles and Ctrl/Cmd+Space grabs. Every
        // unambiguous alternative chord collides with a browser or OS shortcut
        // (Cmd+M, Ctrl+M, Ctrl+Shift+M, Alt+Space), and the only casualty is
        // APG's Ctrl+Space, which APG itself calls a redundant alias for Space.
        // With no selection wired, Space still grabs exactly as it always did.
        if (this._isMultiSelect() && !ctrlOrMeta) {
          this._toggleSelection(active);
          return true;
        }
        return this._grab();
      default:
        return false;
    }
  }

  private _handleGrabbedKey(key: string): boolean {
    const grabbed = this._grabbed;
    switch (key) {
      case 'ArrowDown':
        this._movePreview(1);
        return true;
      case 'ArrowUp':
        this._movePreview(-1);
        return true;
      case 'Home':
        this._movePreview(Number.NEGATIVE_INFINITY);
        return true;
      case 'End':
        this._movePreview(Number.POSITIVE_INFINITY);
        return true;
      case ' ':
        if (this._preview) {
          this._options.onDrop({
            node: grabbed[0] ?? null,
            nodes: grabbed,
            target: this._preview,
            dataTransfer: null,
          });
          this._options.announce?.(this._messages.dropped(grabbed, this._preview));
        }
        this._clearGrab();
        this._notify();
        return true;
      case 'Escape':
        this._clearGrab();
        this._options.announce?.(this._messages.cancelled(grabbed));
        this._notify();
        return true;
      default:
        return false;
    }
  }

  // MARK: - Grab mode

  private _grab(): boolean {
    const active = this.activeNode();
    if (!active || this._options.isDisabled?.() || active.canDrag === false) {
      return false;
    }
    // The `canDrag` guard above is deliberate: grabbing from a locked row must
    // not quietly grab the rest of the selection instead, which would diverge
    // from the pointer engine (it cancels `dragstart` on a locked row).
    const selected = this._isMultiSelect() ? (this._options.selection?.selectedNodes() ?? []) : [];
    const base = selected.includes(active) ? selected : [active];
    const nodes = normalizeDragNodes(base, this._options.state.visibleNodes());
    if (nodes.length === 0) {
      return false;
    }
    this._grabbed = nodes;
    this._grabbedSet = new Set(nodes);
    this._preview = this._initialPreview();
    this._options.announce?.(this._messages.grabbed(nodes));
    this._notify();
    return true;
  }

  /** Whether the selection keys are active — a model is wired and not gated off. */
  private _isMultiSelect(): boolean {
    return !!this._options.selection && this._options.isMultiSelectEnabled?.() !== false;
  }

  private _toggleSelection(node: TreeNode<T>): void {
    const selection = this._options.selection!;
    if (selection.toggle(node)) {
      this._options.announce?.(this._messages.selectionChanged(selection.size()));
    }
    this._notify();
  }

  private _selectAllVisible(): void {
    const selection = this._options.selection!;
    if (selection.selectAllVisible()) {
      this._options.announce?.(this._messages.selectionChanged(selection.size()));
    }
    this._notify();
  }

  private _clearGrab(): void {
    this._grabbed = [];
    this._grabbedSet.clear();
    this._preview = null;
  }

  /** Whether a row can never host a drop preview for the current grab. */
  private _isExcluded(node: TreeNode<T>): boolean {
    return this._grabbedSet.has(node) || isDescendantOfAny(node, this._grabbedSet);
  }

  /**
   * Builds the drop positions in visual top-to-bottom order: a leading
   * `before` for the first row, `into` for every folder, and `after` for rows
   * without visible children (an expanded folder's own `after` coincides
   * visually with its last descendant's, so it is represented there). The
   * grabbed subtree and positions rejected by `canDropAt` are excluded.
   */
  private _candidates(): DropTarget<T>[] {
    const state = this._options.state;
    const visible = state.visibleNodes().filter(node => !this._isExcluded(node));

    const positions: DropTarget<T>[] = [];
    const push = (target: DropTarget<T>): void => {
      if (this._options.canDropAt?.(this._grabbed, target) !== false) {
        positions.push(target);
      }
    };

    const first = visible[0];
    if (first) {
      push({ node: first, mode: 'before' });
    }
    for (const node of visible) {
      if (node.isFolder) {
        push({ node, mode: 'into' });
      }
      if (!(state.isExpandedNow(node) && this._hasVisibleChildren(node))) {
        push({ node, mode: 'after' });
      }
    }
    return positions;
  }

  /** Starts the preview at the grabbed payload's current location. */
  private _initialPreview(): DropTarget<T> | null {
    const candidates = this._candidates();
    const visible = this._options.state.visibleNodes();
    const first = this._grabbed[0];
    if (!first) {
      return candidates[0] ?? null;
    }
    const grabbedIndex = visible.indexOf(first);
    let previous: TreeNode<T> | null = null;
    for (let index = grabbedIndex - 1; index >= 0; index--) {
      const node = visible[index]!;
      if (!this._isExcluded(node)) {
        previous = node;
        break;
      }
    }
    if (previous) {
      for (let index = candidates.length - 1; index >= 0; index--) {
        if (candidates[index]!.node === previous) {
          return candidates[index]!;
        }
      }
    }
    return candidates[0] ?? null;
  }

  private _movePreview(delta: number): void {
    const candidates = this._candidates();
    if (candidates.length === 0) {
      return;
    }
    const currentIndex = this._preview
      ? candidates.findIndex(
          candidate =>
            candidate.node === this._preview!.node && candidate.mode === this._preview!.mode
        )
      : -1;
    const nextIndex = Math.max(
      0,
      Math.min(candidates.length - 1, (currentIndex === -1 ? 0 : currentIndex) + delta)
    );
    const next = candidates[nextIndex]!;
    if (next !== this._preview) {
      this._preview = next;
      const visibleIndex = this._options.state.visibleNodes().indexOf(next.node);
      if (visibleIndex >= 0) {
        this._options.scrollToIndex?.(visibleIndex);
      }
      this._options.announce?.(this._messages.moved(next));
      this._notify();
    }
  }

  // MARK: - Helpers

  /**
   * Moves the active row, optionally extending the selection range to it.
   *
   * Selection never follows focus on its own: arrowing through a 10k-row tree
   * would otherwise emit a selection change per row. Only Shift extends.
   */
  private _moveActive(index: number, extendSelection = false): void {
    const visible = this._options.state.visibleNodes();
    const node = visible[index];
    if (!node) {
      return;
    }
    const moved = this._activeId !== node.id;
    if (moved) {
      this._activeId = node.id;
      this._options.scrollToIndex?.(index);
    }
    let selectionChanged = false;
    if (extendSelection && this._isMultiSelect()) {
      const selection = this._options.selection!;
      selectionChanged = selection.selectRangeTo(node);
      if (selectionChanged) {
        this._options.announce?.(this._messages.selectionChanged(selection.size()));
      }
    }
    if (moved || selectionChanged) {
      this._notify();
    }
  }

  private _isExpandableFolder(node: TreeNode<T>): boolean {
    return !!node.isFolder || !!node.expandable;
  }

  private _hasVisibleChildren(node: TreeNode<T>): boolean {
    return !!node.children?.length;
  }

  private _notify(): void {
    this._options.onStateChange?.();
  }
}
