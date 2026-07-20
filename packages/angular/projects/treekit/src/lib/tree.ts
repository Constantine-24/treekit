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
  untracked,
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

/** Precomputed render model for one virtualized row. */
export interface TkTreeRow<T> {
  readonly node: TreeNode<T>;
  readonly index: number;
  readonly start: number;
  readonly size: number;
  readonly expandable: boolean;
  readonly expanded: boolean;
  readonly ariaExpanded: boolean | null;
  readonly canDrag: boolean;
}

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
 * holds focus (`role="tree"`) and rows are `treeitem`s addressed by id.
 * Keyboard navigation keeps the active row rendered via `scrollToIndex`; if
 * pointer scrolling pushes it out of the rendered window, the
 * `aria-activedescendant` reference is dropped until it is rendered again,
 * so the attribute never points at a missing element.
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

  /**
   * Overscan rows for the default fixed-height virtualizer. Applied when the
   * tree attaches; later changes take effect on the next re-attach.
   */
  overscan = input(4);

  /** Disables all drag-and-drop interactions. */
  isReadonly = input(false);

  /** Id of the selected node for highlighting. */
  selectedId = input<string | null>(null);

  /** Accessible name for the tree. */
  ariaLabel = input<string | null>(null);

  /** Indentation per tree level in pixels. */
  indentWidth = input(18);

  /** Distance from the viewport edge that triggers drag auto-scroll. */
  autoScrollEdge = input(36);

  // MARK: - Outputs

  /** A pointer or keyboard drop resolved over the tree. */
  dropped = output<DropEvent<T>>();

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

  private readonly _announcement = signal('');

  /** Latest screen-reader announcement from the keyboard DnD mode. */
  announcement = this._announcement.asReadonly();

  private _activeVirtualizer: TreeVirtualizer | null = null;
  private _engine: DndEngine<T> | null = null;
  private _keyboard: KeyboardController<T> | null = null;

  visibleNodes = computed(() => {
    this._version();
    return this.state().visibleNodes();
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

  /** Render models for the currently virtualized rows. */
  rows = computed<TkTreeRow<T>[]>(() => {
    this._version();
    const state = this.state();
    const visible = state.visibleNodes();
    const readonly = this.isReadonly();
    const result: TkTreeRow<T>[] = [];
    for (const item of this._activeVirtualizer?.items() ?? []) {
      const node = visible[item.index];
      if (!node) {
        continue;
      }
      const expandableFolder = !!node.isFolder || !!node.expandable;
      result.push({
        node,
        index: item.index,
        start: item.start,
        size: item.size,
        expandable: !!(node.isFolder && node.children?.length) || !!node.expandable,
        expanded: state.isExpandedNow(node),
        ariaExpanded: expandableFolder ? state.isExpandedNow(node) : null,
        canDrag: !readonly && node.canDrag !== false,
      });
    }
    return result;
  });

  /**
   * Id of the active row for `aria-activedescendant` — only while that row is
   * actually rendered, so the reference never points at a missing element.
   */
  activeDescendant = computed(() => {
    this._version();
    const active = this._keyboard?.activeNode();
    if (!active) {
      return null;
    }
    const rendered = this.rows().some((row) => row.node === active);
    return rendered ? `tk-node-${active.id}` : null;
  });

  constructor() {
    effect((onCleanup) => {
      const unsubscribe = this.state().subscribe(() => this._bump());
      onCleanup(unsubscribe);
    });

    effect((onCleanup) => {
      const viewport = this._viewport()?.nativeElement;
      const content = this._content()?.nativeElement;
      const state = this.state();
      const customVirtualizer = this.virtualizer();
      if (!viewport || !content) {
        return;
      }
      onCleanup(this._attachEngines(viewport, content, state, customVirtualizer));
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

    effect(() => {
      const indentWidth = this.indentWidth();
      const autoScrollEdge = this.autoScrollEdge();
      this._version();
      this._engine?.updateOptions({ indentWidth, autoScrollEdge });
    });
  }

  // MARK: - Template API

  onToggle(node: TreeNode<T>, event: Event): void {
    event.stopPropagation();
    this.state().toggle(node);
  }

  onRowClick(node: TreeNode<T>): void {
    this._keyboard?.setActive(node);
    this._viewport()?.nativeElement.focus({ preventScroll: true });
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

  /**
   * Creates and attaches the virtualizer, DnD engine, and keyboard layer.
   * Scalar option inputs are read untracked so their changes flow through the
   * dedicated update effects instead of tearing the engines down (which would
   * reset keyboard focus and any in-flight drag).
   */
  private _attachEngines(
    viewport: HTMLElement,
    content: HTMLElement,
    state: TreeState<T>,
    customVirtualizer: TreeVirtualizer | null,
  ): () => void {
    const virtualizer =
      customVirtualizer ??
      untracked(
        () =>
          new FixedHeightVirtualizer({ rowHeight: this.rowHeight(), overscan: this.overscan() }),
      );
    this._activeVirtualizer = virtualizer;
    virtualizer.setCount(state.visibleNodes().length);

    const engine = new DndEngine<T>({
      getVisibleNodes: () => this.state().visibleNodes(),
      onDrop: (dropEvent) => this._zone.run(() => this.dropped.emit(dropEvent)),
      onStateChange: () => this._bump(),
      isDisabled: () => this.isReadonly(),
      canDropAt: (node, target) => (node ? this.state().canMove(node, target) : true),
      autoScrollEdge: untracked(this.autoScrollEdge),
      indentWidth: untracked(this.indentWidth),
    });
    this._engine = engine;

    this._keyboard = new KeyboardController<T>({
      state,
      onDrop: (dropEvent) => this.dropped.emit(dropEvent),
      canDropAt: (node, target) => (node ? this.state().canMove(node, target) : true),
      isDisabled: () => this.isReadonly(),
      onStateChange: () => this._bump(),
      announce: (message) => this._announcement.set(message),
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
