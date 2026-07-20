import type { DropEvent, DropTarget, TreeNode } from '../tree/model';
import { isDescendant, TreeState } from '../tree/tree-state';

/** Announcement texts for the keyboard DnD mode; override for localization. */
export interface KeyboardMessages<T> {
  grabbed: (node: TreeNode<T>) => string;
  moved: (target: DropTarget<T>) => string;
  dropped: (node: TreeNode<T>, target: DropTarget<T>) => string;
  cancelled: (node: TreeNode<T>) => string;
}

function defaultMessages<T>(): KeyboardMessages<T> {
  return {
    grabbed: node =>
      `${node.name} grabbed. Use arrow keys to choose a position, Space to drop, Escape to cancel.`,
    moved: target =>
      target.mode === 'into'
        ? `Into ${target.node.name}`
        : `${target.mode === 'before' ? 'Before' : 'After'} ${target.node.name}`,
    dropped: (node, target) =>
      target.mode === 'into'
        ? `${node.name} dropped into ${target.node.name}.`
        : `${node.name} dropped ${target.mode} ${target.node.name}.`,
    cancelled: node => `Move of ${node.name} cancelled.`,
  };
}

/** Configuration for a `KeyboardController`. */
export interface KeyboardControllerOptions<T> {
  /** The tree state to navigate and mutate-preview against. */
  state: TreeState<T>;
  /** Receives keyboard drops — the same contract as the pointer `DndEngine`. */
  onDrop: (event: DropEvent<T>) => void;
  /** Validation hook for drop positions — wire `TreeState.canMove` here. */
  canDropAt?: (node: TreeNode<T> | null, target: DropTarget<T>) => boolean;
  /** Disables grabbing while it returns `true`. */
  isDisabled?: () => boolean;
  /** Fires when active row, grab state, or drop preview change. */
  onStateChange?: () => void;
  /** Receives live-region announcements for screen readers. */
  announce?: (message: string) => void;
  /** Keeps the active/previewed row scrolled into view (visible-list index). */
  scrollToIndex?: (index: number) => void;
  /** Announcement text overrides. */
  messages?: Partial<KeyboardMessages<T>>;
}

/**
 * Headless keyboard layer: ARIA tree navigation (roving tabindex, arrow keys,
 * Home/End, expand/collapse) plus an accessible drag-and-drop mode. Space
 * grabs the active row, arrows step a drop preview through the same
 * into/before/after positions the pointer engine resolves, Space drops
 * (emitting an identical `DropEvent`), Escape cancels. This is the supported
 * DnD path for touch devices and assistive technology, since native HTML5
 * drag does not fire from touch gestures on all platforms.
 */
export class KeyboardController<T> {
  private readonly _options: KeyboardControllerOptions<T>;
  private readonly _messages: KeyboardMessages<T>;
  private _activeId: string | null = null;
  private _grabbed: TreeNode<T> | null = null;
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

  /** The node currently grabbed for a keyboard move, or `null`. */
  grabbedNode(): TreeNode<T> | null {
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
    if (this._grabbed) {
      return this._handleGrabbedKey(event.key);
    }
    return this._handleNavigationKey(event.key);
  }

  private _handleNavigationKey(key: string): boolean {
    const state = this._options.state;
    const visible = state.visibleNodes();
    const active = this.activeNode();
    if (!active || visible.length === 0) {
      return false;
    }
    const index = visible.indexOf(active);

    switch (key) {
      case 'ArrowDown':
        this._moveActive(Math.min(visible.length - 1, index + 1));
        return true;
      case 'ArrowUp':
        this._moveActive(Math.max(0, index - 1));
        return true;
      case 'Home':
        this._moveActive(0);
        return true;
      case 'End':
        this._moveActive(visible.length - 1);
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
      case ' ':
        return this._grab(active);
      default:
        return false;
    }
  }

  private _handleGrabbedKey(key: string): boolean {
    const grabbed = this._grabbed!;
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
          this._options.onDrop({ node: grabbed, target: this._preview, dataTransfer: null });
          this._options.announce?.(this._messages.dropped(grabbed, this._preview));
        }
        this._grabbed = null;
        this._preview = null;
        this._notify();
        return true;
      case 'Escape':
        this._grabbed = null;
        this._preview = null;
        this._options.announce?.(this._messages.cancelled(grabbed));
        this._notify();
        return true;
      default:
        return false;
    }
  }

  // MARK: - Grab mode

  private _grab(node: TreeNode<T>): boolean {
    if (this._options.isDisabled?.() || node.canDrag === false) {
      return false;
    }
    this._grabbed = node;
    this._preview = this._initialPreview(node);
    this._options.announce?.(this._messages.grabbed(node));
    this._notify();
    return true;
  }

  /**
   * Builds the drop positions in visual top-to-bottom order: a leading
   * `before` for the first row, `into` for every folder, and `after` for rows
   * without visible children (an expanded folder's own `after` coincides
   * visually with its last descendant's, so it is represented there). The
   * grabbed subtree and positions rejected by `canDropAt` are excluded.
   */
  private _candidates(): DropTarget<T>[] {
    const grabbed = this._grabbed;
    const state = this._options.state;
    const visible = state
      .visibleNodes()
      .filter(node => !grabbed || (node !== grabbed && !isDescendant(node, grabbed)));

    const positions: DropTarget<T>[] = [];
    const push = (target: DropTarget<T>): void => {
      if (this._options.canDropAt?.(grabbed, target) !== false) {
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

  /** Starts the preview at the grabbed node's current location. */
  private _initialPreview(grabbed: TreeNode<T>): DropTarget<T> | null {
    const candidates = this._candidates();
    const visible = this._options.state.visibleNodes();
    const grabbedIndex = visible.indexOf(grabbed);
    let previous: TreeNode<T> | null = null;
    for (let index = grabbedIndex - 1; index >= 0; index--) {
      const node = visible[index]!;
      if (node !== grabbed && !isDescendant(node, grabbed)) {
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

  private _moveActive(index: number): void {
    const visible = this._options.state.visibleNodes();
    const node = visible[index];
    if (!node) {
      return;
    }
    if (this._activeId !== node.id) {
      this._activeId = node.id;
      this._options.scrollToIndex?.(index);
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
