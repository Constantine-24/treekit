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
  SelectionModel,
  TreeNode,
  TreeState,
  TreeVirtualizer,
} from '@treekit/core';

import { TkTreeNodeDef } from './tree-node-def';
import { TkTreeEmptyDef, TkTreeLoadingDef } from './tree-placeholders';
import { TkTreeRowMeasure } from './tree-row-measure';

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
  readonly selected: boolean;
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
  imports: [NgTemplateOutlet, TkTreeRowMeasure],
  host: { class: 'tk-tree', '[style.--tk-indent-width]': 'indentWidth() + "px"' },
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

  /** Id of the selected node for highlighting. Single-select convenience. */
  selectedId = input<string | null>(null);

  /**
   * Enables ctrl/cmd-click, shift-click, Shift+arrows and Ctrl/Cmd+A, and makes
   * a drag that starts on a selected row carry the whole selection.
   *
   * Left off, the component stays fully controlled exactly as before: clicking
   * emits `nodeClick` and never moves the highlight on its own, so a consumer
   * can refuse a selection.
   *
   * Note the keyboard change this brings: with multi-select on, `Space` toggles
   * selection and `Ctrl/Cmd+Space` grabs a row for keyboard drag-and-drop.
   */
  multiSelect = input(false);

  /**
   * Selected node ids. Bind for controlled mode — `[(selectedIds)]` works —
   * or leave unset and let `multiSelect` drive selection internally.
   *
   * Signal inputs only react to identity changes, so a consumer overriding a
   * selection must emit a new array, not mutate the existing one.
   */
  selectedIds = input<readonly string[] | ReadonlySet<string> | null>(null);

  /** Accessible name for the tree. */
  ariaLabel = input<string | null>(null);

  /** Indentation per tree level in pixels. */
  indentWidth = input(18);

  /** Distance from the viewport edge that triggers drag auto-scroll. */
  autoScrollEdge = input(36);

  /** Draws vertical guide lines down the indentation. */
  indentGuides = input(false);

  /**
   * Milliseconds a collapsed folder must be hovered mid-drag before it expands
   * ("spring loading"). `0` disables it.
   */
  springLoadDelay = input(0);

  /**
   * CSS selector for a drag handle inside a row. When set, drags starting
   * anywhere else in the row are cancelled — so a row can be draggable only by
   * an explicit grip.
   */
  dragHandleSelector = input<string | null>(null);

  /** Shows the projected `tkTreeLoading` template instead of any rows. */
  isLoading = input(false);

  // MARK: - Outputs

  /** A pointer or keyboard drop resolved over the tree. */
  dropped = output<DropEvent<T>>();

  /** A row was clicked. */
  nodeClick = output<TreeNode<T>>();

  /** A row was double-clicked. */
  nodeDblClick = output<TreeNode<T>>();

  /** A row was right-clicked. */
  nodeContextMenu = output<{ event: MouseEvent; node: TreeNode<T> }>();

  /** Selection changed. Named so `[(selectedIds)]` binds two-way. */
  selectedIdsChange = output<readonly string[]>();

  /** The same change, resolved to the currently visible nodes in document order. */
  selectionChange = output<readonly TreeNode<T>[]>();

  /** A folder was expanded from its toggle. Programmatic expansion does not emit. */
  expanded = output<TreeNode<T>>();

  /** A folder was collapsed from its toggle. Programmatic collapse does not emit. */
  collapsed = output<TreeNode<T>>();

  // MARK: - Projection & view

  nodeDef = contentChild(TkTreeNodeDef<T>);
  emptyDef = contentChild(TkTreeEmptyDef);
  loadingDef = contentChild(TkTreeLoadingDef);

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

  /**
   * Live engine handles. These are signals rather than plain fields so the
   * option-push effects below can depend on the handle itself instead of
   * reading `_version` — which would re-run them on every scroll frame and
   * every `dragover`.
   */
  private readonly _activeVirtualizer = signal<TreeVirtualizer | null>(null);
  private readonly _engine = signal<DndEngine<T> | null>(null);
  private readonly _keyboard = signal<KeyboardController<T> | null>(null);
  private readonly _selection = signal<SelectionModel<T> | null>(null);

  private static readonly _noIds: ReadonlySet<string> = new Set<string>();

  /**
   * Selected ids for this render, derived once rather than per row.
   *
   * In multi-select mode the internal model is the source of truth (with
   * `[selectedIds]` written into it by a dedicated effect); otherwise the
   * inputs are read directly, keeping the fully-controlled contract.
   */
  private readonly _selectedIdSet = computed<ReadonlySet<string>>(() => {
    this._version();
    if (this.multiSelect()) {
      return this._selection()?.selectedIds() ?? TkTree._noIds;
    }
    const ids = this.selectedIds();
    if (ids) {
      return ids instanceof Set ? ids : new Set(ids);
    }
    const id = this.selectedId();
    return id ? new Set([id]) : TkTree._noIds;
  });

  visibleNodes = computed(() => {
    this._version();
    return this.state().visibleNodes();
  });

  totalSize = computed(() => {
    this._version();
    return this._activeVirtualizer()?.totalSize() ?? 0;
  });

  hoveredFolder = computed(() => {
    this._version();
    return this._engine()?.hoveredFolder() ?? null;
  });

  insertionLine = computed(() => {
    this._version();
    return this._engine()?.insertionLine() ?? null;
  });

  /** Render models for the currently virtualized rows. */
  rows = computed<TkTreeRow<T>[]>(() => {
    this._version();
    const state = this.state();
    const visible = state.visibleNodes();
    const readonly = this.isReadonly();
    const selectedIds = this._selectedIdSet();
    const result: TkTreeRow<T>[] = [];
    for (const item of this._activeVirtualizer()?.items() ?? []) {
      const node = visible[item.index];
      if (!node) {
        continue;
      }
      const expandableFolder = !!node.isFolder || !!node.expandable;
      const expandedNow = state.isExpandedNow(node);
      result.push({
        node,
        index: item.index,
        start: item.start,
        size: item.size,
        expandable: !!(node.isFolder && node.children?.length) || !!node.expandable,
        expanded: expandedNow,
        ariaExpanded: expandableFolder ? expandedNow : null,
        canDrag: !readonly && node.canDrag !== false,
        selected: selectedIds.has(node.id),
      });
    }
    return result;
  });

  /**
   * The active virtualizer when it measures rows, otherwise `null`.
   *
   * Rows pin their height only in the fixed-size case. A measured row has to be
   * free to size to its content — pinning it would feed the estimate straight
   * back as the measurement and variable heights could never converge.
   */
  protected readonly measuringVirtualizer = computed<TreeVirtualizer | null>(() => {
    const virtualizer = this._activeVirtualizer();
    return virtualizer?.measure ? virtualizer : null;
  });

  /**
   * Id of the active row for `aria-activedescendant` — only while that row is
   * actually rendered, so the reference never points at a missing element.
   */
  activeDescendant = computed(() => {
    this._version();
    const active = this._keyboard()?.activeNode();
    if (!active) {
      return null;
    }
    const rendered = this.rows().some((row) => row.node === active);
    return rendered ? `tk-node-${active.id}` : null;
  });

  constructor() {
    effect((onCleanup) => {
      const unsubscribe = this.state().subscribe(() => {
        // Structural changes can remove selected nodes; dropping their ids is
        // only observable to consumers that serialize the raw set, but it is
        // cheap next to the recompute that just ran.
        this._selection()?.prune();
        this._bump();
      });
      onCleanup(unsubscribe);
    });

    effect(() => {
      const ids = this.selectedIds();
      const selection = this._selection();
      if (ids && selection) {
        selection.setIds(ids);
      }
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
      this._activeVirtualizer()?.setCount(this.visibleNodes().length);
    });

    effect(() => {
      const rowHeight = this.rowHeight();
      const active = this._activeVirtualizer();
      if (active instanceof FixedHeightVirtualizer) {
        active.setRowHeight(rowHeight);
      }
    });

    effect(() => {
      const indentWidth = this.indentWidth();
      const autoScrollEdge = this.autoScrollEdge();
      const springLoadDelay = this.springLoadDelay();
      const dragHandleSelector = this.dragHandleSelector() ?? undefined;
      this._engine()?.updateOptions({
        indentWidth,
        autoScrollEdge,
        springLoadDelay,
        dragHandleSelector,
      });
    });
  }

  // MARK: - Template API

  onToggle(node: TreeNode<T>, event: Event): void {
    event.stopPropagation();
    const state = this.state();
    const wasExpanded = state.isExpandedNow(node);
    state.toggle(node);
    const isExpanded = state.isExpandedNow(node);
    if (isExpanded !== wasExpanded) {
      (isExpanded ? this.expanded : this.collapsed).emit(node);
    }
  }

  // MARK: - Imperative API

  /** Expands every loaded folder. Does not trigger lazy loads. */
  expandAll(): void {
    this.state().expandAll();
  }

  /** Collapses every folder. */
  collapseAll(): void {
    this.state().collapseAll();
  }

  /**
   * Scrolls a node into view. Returns whether it was found among the visible
   * rows — a node hidden by collapse or filter cannot be scrolled to.
   */
  scrollToNode(nodeOrId: TreeNode<T> | string): boolean {
    const id = typeof nodeOrId === 'string' ? nodeOrId : nodeOrId.id;
    const index = this.state()
      .visibleNodes()
      .findIndex((node) => node.id === id);
    if (index < 0) {
      return false;
    }
    this._activeVirtualizer()?.scrollToIndex?.(index);
    return true;
  }

  onRowClick(node: TreeNode<T>, event: MouseEvent): void {
    this._keyboard()?.setActive(node);
    const selection = this._selection();
    if (this.multiSelect() && selection) {
      selection.selectOn(node, {
        ctrlOrMeta: event.ctrlKey || event.metaKey,
        shift: event.shiftKey,
      });
    }
    this._viewport()?.nativeElement.focus({ preventScroll: true });
    this.nodeClick.emit(node);
  }

  onContextMenu(event: MouseEvent, node: TreeNode<T>): void {
    event.preventDefault();
    this.nodeContextMenu.emit({ event, node });
  }

  onKeydown(event: KeyboardEvent): void {
    if (this._keyboard()?.handleKeyDown(event)) {
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
    const selection = new SelectionModel<T>({
      state,
      onChange: () => {
        this._bump();
        this._zone.run(() => {
          this.selectedIdsChange.emit([...selection.selectedIds()]);
          this.selectionChange.emit(selection.selectedNodes());
        });
      },
    });

    const engine = new DndEngine<T>({
      getVisibleNodes: () => this.state().visibleNodes(),
      getSelectedNodes: () => (this.multiSelect() ? selection.selectedNodes() : []),
      onDragSelectionReset: (node) => {
        if (this.multiSelect()) {
          selection.select(node);
        }
      },
      onDrop: (dropEvent) => this._zone.run(() => this.dropped.emit(dropEvent)),
      onStateChange: () => this._bump(),
      isDisabled: () => this.isReadonly(),
      canDropAt: (nodes, target) => this.state().canMoveMany(nodes, target),
      autoScrollEdge: untracked(this.autoScrollEdge),
      indentWidth: untracked(this.indentWidth),
      springLoadDelay: untracked(this.springLoadDelay),
      dragHandleSelector: untracked(this.dragHandleSelector) ?? undefined,
      // Reports only — the core never mutates the tree, so expanding is ours.
      onSpringLoad: (node) => this._zone.run(() => this.state().expand(node)),
    });

    const keyboard = new KeyboardController<T>({
      state,
      selection,
      isMultiSelectEnabled: () => this.multiSelect(),
      // Wrapped for the same reason as the pointer engine: `onDrop` calls into
      // consumer code, which may update state the consumer renders elsewhere.
      // The internal `_bump`/`announce` callbacks are plain signal writes and
      // notify the scheduler on their own, so they are deliberately unwrapped.
      onDrop: (dropEvent) => this._zone.run(() => this.dropped.emit(dropEvent)),
      canDropAt: (nodes, target) => this.state().canMoveMany(nodes, target),
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

    // Counted after attaching so the virtualizer already has its viewport and
    // change callback, and can compute and report its first range.
    virtualizer.setCount(state.visibleNodes().length);

    this._activeVirtualizer.set(virtualizer);
    this._engine.set(engine);
    this._keyboard.set(keyboard);
    this._selection.set(selection);
    this._bump();

    return () => {
      detachVirtualizer?.();
      detachEngine?.();
      this._activeVirtualizer.set(null);
      this._engine.set(null);
      this._keyboard.set(null);
      this._selection.set(null);
    };
  }

  private _bump(): void {
    this._version.update((version) => version + 1);
  }
}
