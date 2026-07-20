import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  contentChild,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  DndEngine,
  DropEvent,
  FixedHeightVirtualizer,
  KeyboardController,
  TreeNode,
  TreeState,
  TreeVirtualizer,
} from '@treekit/core';

import { TkTreeNodeDef } from './tree-node-def';

/**
 * Virtualized tree with native HTML5 drag-and-drop and keyboard-accessible
 * DnD, rendered over a consumer-owned `TreeState` from `@treekit/core`.
 *
 * The component is a thin adapter: all tree logic (visibility, mutations,
 * filtering, drop resolution, keyboard semantics) lives in the headless core;
 * this class wires the engines to the DOM, exposes their feedback as signals,
 * and renders rows through an optional projected `tkTreeNodeDef` template.
 *
 * Accessibility follows the `aria-activedescendant` pattern: the viewport
 * holds focus (`role="tree"`), rows are `treeitem`s addressed by id — correct
 * under virtualization where the active row's element may not be rendered.
 */
@Component({
  selector: 'tk-tree',
  templateUrl: './tree.html',
  styleUrl: './tree.scss',
  imports: [NgTemplateOutlet],
  host: { class: 'tk-tree' },
})
export class TkTree<T> {
  private readonly _zone = inject(NgZone);

  // MARK: - Inputs

  /** The headless tree state driving this view. */
  state = input.required<TreeState<T>>();

  /** Custom virtualizer; defaults to the built-in fixed-height one. */
  virtualizer = input<TreeVirtualizer | null>(null);

  /** Row height in pixels for the default fixed-height virtualizer. */
  rowHeight = input(32);

  /** Overscan rows for the default fixed-height virtualizer. */
  overscan = input(4);

  /** Disables all drag-and-drop interactions. */
  isReadonly = input(false);

  /** Id of the selected node for highlighting. */
  selectedId = input<string | null>(null);

  /** Indentation per tree level in pixels. */
  indentWidth = input(18);

  /** Distance from the viewport edge that triggers drag auto-scroll. */
  autoScrollEdge = input(36);

  // MARK: - Outputs

  /** A pointer or keyboard drop resolved over the tree. */
  dropElement = output<DropEvent<T>>();

  /** A row was clicked. */
  nodeClick = output<TreeNode<T>>();

  /** A row was double-clicked. */
  nodeDblClick = output<TreeNode<T>>();

  /** A row was right-clicked. */
  nodeContextMenu = output<{ event: MouseEvent; node: TreeNode<T> }>();

  // MARK: - Projection & view

  nodeDef = contentChild(TkTreeNodeDef<T>);

  private readonly _viewport = viewChild<ElementRef<HTMLDivElement>>('viewport');
  private readonly _content = viewChild<ElementRef<HTMLDivElement>>('content');

  // MARK: - Engine state

  /**
   * Monotonic version bumped by every engine/state notification; computeds
   * read it to re-derive from the non-reactive core objects.
   */
  private readonly _version = signal(0);

  /** Latest screen-reader announcement from the keyboard DnD mode. */
  announcement = signal('');

  private _activeVirtualizer: TreeVirtualizer | null = null;
  private _engine: DndEngine<T> | null = null;
  private _keyboard: KeyboardController<T> | null = null;

  visibleNodes = computed(() => {
    this._version();
    return this.state().visibleNodes();
  });

  virtualItems = computed(() => {
    this._version();
    return this._activeVirtualizer?.items() ?? [];
  });

  totalSize = computed(() => {
    this._version();
    return this._activeVirtualizer?.totalSize() ?? 0;
  });

  hoveredFolder = computed(() => {
    this._version();
    return this._engine?.hoveredFolder() ?? null;
  });

  insertionLine = computed(() => {
    this._version();
    return this._engine?.insertionLine() ?? null;
  });

  activeDescendant = computed(() => {
    this._version();
    const active = this._keyboard?.activeNode();
    return active ? `tk-node-${active.id}` : null;
  });

  constructor() {
    effect((onCleanup) => {
      const unsubscribe = this.state().subscribe(() => this._bump());
      onCleanup(unsubscribe);
    });

    effect((onCleanup) => {
      const viewport = this._viewport()?.nativeElement;
      const content = this._content()?.nativeElement;
      if (!viewport || !content) {
        return;
      }
      onCleanup(this._attachEngines(viewport, content));
    });

    effect(() => {
      this._activeVirtualizer?.setCount(this.visibleNodes().length);
    });

    effect(() => {
      const rowHeight = this.rowHeight();
      this._version();
      const active = this._activeVirtualizer;
      if (active instanceof FixedHeightVirtualizer) {
        active.setRowHeight(rowHeight);
      }
    });
  }

  // MARK: - Template API

  isExpandable(node: TreeNode<T>): boolean {
    return !!(node.isFolder && node.children?.length) || !!node.expandable;
  }

  isExpandedNow(node: TreeNode<T>): boolean {
    return this.state().isExpandedNow(node);
  }

  ariaExpanded(node: TreeNode<T>): boolean | null {
    return node.isFolder || node.expandable ? this.state().isExpandedNow(node) : null;
  }

  canDrag(node: TreeNode<T>): boolean {
    return !this.isReadonly() && node.canDrag !== false;
  }

  onToggle(node: TreeNode<T>, event: Event): void {
    event.stopPropagation();
    this.state().toggle(node);
  }

  onRowClick(node: TreeNode<T>): void {
    this._keyboard?.setActive(node);
    this.nodeClick.emit(node);
  }

  onContextMenu(event: MouseEvent, node: TreeNode<T>): void {
    event.preventDefault();
    this.nodeContextMenu.emit({ event, node });
  }

  onKeydown(event: KeyboardEvent): void {
    if (this._keyboard?.handleKeyDown(event)) {
      event.preventDefault();
    }
  }

  // MARK: - Wiring

  /** Creates and attaches the virtualizer, DnD engine, and keyboard layer. */
  private _attachEngines(viewport: HTMLElement, content: HTMLElement): () => void {
    const state = this.state();
    const virtualizer =
      this.virtualizer() ??
      new FixedHeightVirtualizer({ rowHeight: this.rowHeight(), overscan: this.overscan() });
    this._activeVirtualizer = virtualizer;
    virtualizer.setCount(state.visibleNodes().length);

    const engine = new DndEngine<T>({
      getVisibleNodes: () => this.state().visibleNodes(),
      onDrop: (dropEvent) => this._zone.run(() => this.dropElement.emit(dropEvent)),
      onStateChange: () => this._bump(),
      isDisabled: () => this.isReadonly(),
      canDropAt: (node, target) => (node ? this.state().canMove(node, target) : true),
      autoScrollEdge: this.autoScrollEdge(),
      indentWidth: this.indentWidth(),
    });
    this._engine = engine;

    this._keyboard = new KeyboardController<T>({
      state,
      onDrop: (dropEvent) => this.dropElement.emit(dropEvent),
      canDropAt: (node, target) => (node ? this.state().canMove(node, target) : true),
      isDisabled: () => this.isReadonly(),
      onStateChange: () => this._bump(),
      announce: (message) => this.announcement.set(message),
      scrollToIndex: (index) => virtualizer.scrollToIndex?.(index),
    });

    let detachVirtualizer: (() => void) | undefined;
    let detachEngine: (() => void) | undefined;
    this._zone.runOutsideAngular(() => {
      detachVirtualizer = virtualizer.attach(viewport, () => this._bump());
      detachEngine = engine.attach(viewport, content);
    });
    this._bump();

    return () => {
      detachVirtualizer?.();
      detachEngine?.();
      this._activeVirtualizer = null;
      this._engine = null;
      this._keyboard = null;
    };
  }

  private _bump(): void {
    this._version.update((version) => version + 1);
  }
}
