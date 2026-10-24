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
import {
  CSSProperties,
  forwardRef,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactElement,
  ReactNode,
  Ref,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { VersionStore } from './version-store';

/** Precomputed render model for one virtualized row. */
export interface TkTreeRow<T> {
  readonly node: TreeNode<T>;
  readonly index: number;
  readonly start: number;
  readonly size: number;
  readonly expandable: boolean;
  readonly expanded: boolean;
  readonly ariaExpanded: boolean | undefined;
  readonly canDrag: boolean;
  readonly selected: boolean;
}

/** Context passed to `renderNode` alongside the node. */
export interface TkTreeNodeContext<T> {
  /** Index of the row in the visible list. */
  readonly index: number;
  /** The full render model of the row. */
  readonly row: TkTreeRow<T>;
}

/** Props of {@link TkTree}. */
export interface TkTreeProps<T> {
  /** The headless tree state driving this view. Changing the instance re-attaches the engines. */
  state: TreeState<T>;

  /**
   * Custom virtualizer; defaults to the built-in fixed-height one. Changing the
   * instance re-attaches the engines.
   */
  virtualizer?: TreeVirtualizer | null;

  /** Row height in pixels for the default fixed-height virtualizer. Default `32`. */
  rowHeight?: number;

  /**
   * Overscan rows for the default fixed-height virtualizer. Default `4`. Applied
   * when the tree attaches; later changes take effect on the next re-attach.
   */
  overscan?: number;

  /** Disables all drag-and-drop interactions. */
  isReadonly?: boolean;

  /** Id of the selected node for highlighting. Single-select convenience. */
  selectedId?: string | null;

  /**
   * Enables ctrl/cmd-click, shift-click, Shift+arrows and Ctrl/Cmd+A, and makes
   * a drag that starts on a selected row carry the whole selection.
   *
   * Left off, the component stays fully controlled: clicking calls
   * `onNodeClick` and never moves the highlight on its own, so a consumer can
   * refuse a selection.
   *
   * Note the keyboard change this brings: with multi-select on, `Space` toggles
   * selection and `Ctrl/Cmd+Space` grabs a row for keyboard drag-and-drop.
   */
  multiSelect?: boolean;

  /**
   * Selected node ids. Pass together with `onSelectedIdsChange` for controlled
   * mode, or leave unset and let `multiSelect` drive selection internally.
   *
   * Only identity changes are observed, so a consumer overriding a selection
   * must pass a new array, not mutate the existing one.
   */
  selectedIds?: readonly string[] | ReadonlySet<string> | null;

  /** Accessible name for the tree. */
  ariaLabel?: string;

  /** Indentation per tree level in pixels. Default `18`. */
  indentWidth?: number;

  /** Distance from the viewport edge that triggers drag auto-scroll. Default `36`. */
  autoScrollEdge?: number;

  /** Draws vertical guide lines down the indentation. */
  indentGuides?: boolean;

  /**
   * Milliseconds a collapsed folder must be hovered mid-drag before it expands
   * ("spring loading"). `0` (the default) disables it.
   */
  springLoadDelay?: number;

  /**
   * CSS selector for a drag handle inside a row. When set, drags starting
   * anywhere else in the row are cancelled — so a row can be draggable only by
   * an explicit grip.
   */
  dragHandleSelector?: string | null;

  /** Shows `renderLoading` instead of any rows. */
  isLoading?: boolean;

  /** Renders a row's content. Defaults to the node's `name`. */
  renderNode?: (node: TreeNode<T>, context: TkTreeNodeContext<T>) => ReactNode;

  /** Rendered when no row is visible (empty tree, or a filter that matches nothing). */
  renderEmpty?: () => ReactNode;

  /** Rendered while `isLoading` is true. */
  renderLoading?: () => ReactNode;

  /** A pointer or keyboard drop resolved over the tree. The tree is not mutated. */
  onDrop?: (event: DropEvent<T>) => void;

  /** A row was clicked. */
  onNodeClick?: (node: TreeNode<T>) => void;

  /** A row was double-clicked. */
  onNodeDoubleClick?: (node: TreeNode<T>) => void;

  /** A row was right-clicked. The native context menu is suppressed. */
  onNodeContextMenu?: (payload: { event: MouseEvent; node: TreeNode<T> }) => void;

  /** Selection changed. Pair with `selectedIds` for controlled mode. */
  onSelectedIdsChange?: (ids: readonly string[]) => void;

  /** The same change, resolved to the currently visible nodes in document order. */
  onSelectionChange?: (nodes: readonly TreeNode<T>[]) => void;

  /** A folder was expanded from its toggle. Programmatic expansion does not call it. */
  onExpand?: (node: TreeNode<T>) => void;

  /** A folder was collapsed from its toggle. Programmatic collapse does not call it. */
  onCollapse?: (node: TreeNode<T>) => void;

  /** Extra class names for the host element (which always has `tk-tree`). */
  className?: string;

  /** Inline styles for the host element — e.g. `--tk-*` theme tokens or a height. */
  style?: CSSProperties;
}

/** Imperative API exposed through the `ref` of {@link TkTree}. */
export interface TkTreeHandle<T> {
  /** Expands every loaded folder. Does not trigger lazy loads. */
  expandAll(): void;
  /** Collapses every folder. */
  collapseAll(): void;
  /**
   * Scrolls a node into view. Returns whether it was found among the visible
   * rows — a node hidden by collapse or filter cannot be scrolled to.
   */
  scrollToNode(nodeOrId: TreeNode<T> | string): boolean;
}

interface Engines<T> {
  readonly virtualizer: TreeVirtualizer;
  readonly engine: DndEngine<T>;
  readonly keyboard: KeyboardController<T>;
  readonly selection: SelectionModel<T>;
}

const NO_IDS: ReadonlySet<string> = new Set<string>();

function TkTreeInner<T>(props: TkTreeProps<T>, ref: Ref<TkTreeHandle<T>>): ReactElement {
  const {
    state,
    virtualizer: customVirtualizer = null,
    rowHeight = 32,
    isReadonly = false,
    selectedId = null,
    multiSelect = false,
    selectedIds = null,
    ariaLabel,
    indentWidth = 18,
    autoScrollEdge = 36,
    indentGuides = false,
    springLoadDelay = 0,
    dragHandleSelector = null,
    isLoading = false,
    renderNode,
    renderEmpty,
    renderLoading,
    className,
    style,
  } = props;

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // MARK: - Engine state

  // Core objects are not reactive. Every state/engine notification bumps this
  // store, and rendering re-derives everything from the plain objects.
  const [store] = useState(() => new VersionStore());
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const [engines, setEngines] = useState<Engines<T> | null>(null);
  const [announcement, setAnnouncement] = useState('');

  // The engines read callbacks and flags through this ref, so a new inline
  // arrow on every parent render never tears them down (which would reset
  // keyboard focus and any in-flight drag). Assigned in a layout effect that
  // is declared first, so it runs before the attach effect below.
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });

  // MARK: - Wiring

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) {
      return;
    }
    const bump = () => store.bump();
    const virtualizer =
      customVirtualizer ??
      new FixedHeightVirtualizer({
        rowHeight: latest.current.rowHeight ?? 32,
        overscan: latest.current.overscan ?? 4,
      });

    const selection = new SelectionModel<T>({
      state,
      onChange: () => {
        bump();
        latest.current.onSelectedIdsChange?.([...selection.selectedIds()]);
        latest.current.onSelectionChange?.(selection.selectedNodes());
      },
    });

    const engine = new DndEngine<T>({
      getVisibleNodes: () => state.visibleNodes(),
      getSelectedNodes: () => (latest.current.multiSelect ? selection.selectedNodes() : []),
      onDragSelectionReset: node => {
        if (latest.current.multiSelect) {
          selection.select(node);
        }
      },
      onDrop: dropEvent => latest.current.onDrop?.(dropEvent),
      onStateChange: bump,
      isDisabled: () => !!latest.current.isReadonly,
      canDropAt: (nodes, target) => state.canMoveMany(nodes, target),
      autoScrollEdge: latest.current.autoScrollEdge ?? 36,
      indentWidth: latest.current.indentWidth ?? 18,
      springLoadDelay: latest.current.springLoadDelay ?? 0,
      dragHandleSelector: latest.current.dragHandleSelector ?? undefined,
      // Reports only — the core never mutates the tree, so expanding is ours.
      onSpringLoad: node => state.expand(node),
    });

    const keyboard = new KeyboardController<T>({
      state,
      selection,
      isMultiSelectEnabled: () => !!latest.current.multiSelect,
      onDrop: dropEvent => latest.current.onDrop?.(dropEvent),
      canDropAt: (nodes, target) => state.canMoveMany(nodes, target),
      isDisabled: () => !!latest.current.isReadonly,
      onStateChange: bump,
      announce: setAnnouncement,
      scrollToIndex: index => virtualizer.scrollToIndex?.(index),
    });

    const detachVirtualizer = virtualizer.attach(viewport, bump);
    const detachEngine = engine.attach(viewport, content);
    // Structural changes can remove selected nodes; dropping their ids is only
    // observable to consumers that serialize the raw set, but it is cheap next
    // to the recompute that just ran.
    const unsubscribe = state.subscribe(() => {
      selection.prune();
      bump();
    });

    // Counted after attaching so the virtualizer already has its viewport and
    // change callback, and can compute and report its first range.
    virtualizer.setCount(state.visibleNodes().length);
    setEngines({ virtualizer, engine, keyboard, selection });

    return () => {
      unsubscribe();
      detachVirtualizer();
      detachEngine();
      setEngines(null);
    };
  }, [state, customVirtualizer, store]);

  const visibleNodes = state.visibleNodes();

  useLayoutEffect(() => {
    engines?.virtualizer.setCount(visibleNodes.length);
  }, [engines, visibleNodes.length]);

  // MARK: - Option push

  useLayoutEffect(() => {
    if (engines && selectedIds) {
      engines.selection.setIds(selectedIds);
    }
  }, [engines, selectedIds]);

  useLayoutEffect(() => {
    if (engines?.virtualizer instanceof FixedHeightVirtualizer) {
      engines.virtualizer.setRowHeight(rowHeight);
    }
  }, [engines, rowHeight]);

  useLayoutEffect(() => {
    engines?.engine.updateOptions({
      indentWidth,
      autoScrollEdge,
      springLoadDelay,
      dragHandleSelector: dragHandleSelector ?? undefined,
    });
  }, [engines, indentWidth, autoScrollEdge, springLoadDelay, dragHandleSelector]);

  // MARK: - Imperative API

  useImperativeHandle(
    ref,
    () => ({
      expandAll: () => state.expandAll(),
      collapseAll: () => state.collapseAll(),
      scrollToNode: nodeOrId => {
        const id = typeof nodeOrId === 'string' ? nodeOrId : nodeOrId.id;
        const index = state.visibleNodes().findIndex(node => node.id === id);
        if (index < 0) {
          return false;
        }
        engines?.virtualizer.scrollToIndex?.(index);
        return true;
      },
    }),
    [state, engines]
  );

  // MARK: - Render model

  let selectedIdSet: ReadonlySet<string>;
  if (multiSelect) {
    selectedIdSet = engines?.selection.selectedIds() ?? NO_IDS;
  } else if (selectedIds) {
    selectedIdSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
  } else {
    selectedIdSet = selectedId ? new Set([selectedId]) : NO_IDS;
  }

  const rows: TkTreeRow<T>[] = [];
  for (const item of engines?.virtualizer.items() ?? []) {
    const node = visibleNodes[item.index];
    if (!node) {
      continue;
    }
    const expandableFolder = !!node.isFolder || !!node.expandable;
    const expandedNow = state.isExpandedNow(node);
    rows.push({
      node,
      index: item.index,
      start: item.start,
      size: item.size,
      expandable: !!(node.isFolder && node.children?.length) || !!node.expandable,
      expanded: expandedNow,
      ariaExpanded: expandableFolder ? expandedNow : undefined,
      canDrag: !isReadonly && node.canDrag !== false,
      selected: selectedIdSet.has(node.id),
    });
  }

  // Rows pin their height only in the fixed-size case. A measured row has to be
  // free to size to its content — pinning it would feed the estimate straight
  // back as the measurement and variable heights could never converge.
  const measuringVirtualizer = engines?.virtualizer.measure ? engines.virtualizer : null;

  // Only while the active row is actually rendered, so the reference never
  // points at a missing element.
  const activeNode = engines?.keyboard.activeNode() ?? null;
  const activeDescendant =
    activeNode && rows.some(row => row.node === activeNode)
      ? `tk-node-${activeNode.id}`
      : undefined;

  const hoveredFolder = engines?.engine.hoveredFolder() ?? null;
  const insertionLine = engines?.engine.insertionLine() ?? null;

  // MARK: - Event handlers

  const onToggle = (node: TreeNode<T>, event: ReactMouseEvent) => {
    event.stopPropagation();
    const wasExpanded = state.isExpandedNow(node);
    state.toggle(node);
    const isExpanded = state.isExpandedNow(node);
    if (isExpanded !== wasExpanded) {
      (isExpanded ? latest.current.onExpand : latest.current.onCollapse)?.(node);
    }
  };

  const onRowClick = (node: TreeNode<T>, event: ReactMouseEvent) => {
    engines?.keyboard.setActive(node);
    if (multiSelect && engines) {
      engines.selection.selectOn(node, {
        ctrlOrMeta: event.ctrlKey || event.metaKey,
        shift: event.shiftKey,
      });
    }
    viewportRef.current?.focus({ preventScroll: true });
    latest.current.onNodeClick?.(node);
  };

  const onContextMenu = (node: TreeNode<T>, event: ReactMouseEvent) => {
    event.preventDefault();
    latest.current.onNodeContextMenu?.({ event: event.nativeEvent, node });
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (engines?.keyboard.handleKeyDown(event.nativeEvent)) {
      event.preventDefault();
    }
  };

  // MARK: - View

  let placeholder: ReactNode = null;
  if (isLoading) {
    placeholder = renderLoading?.() ?? null;
  } else if (visibleNodes.length === 0) {
    placeholder = renderEmpty?.() ?? null;
  }

  return (
    <div
      className={className ? `tk-tree ${className}` : 'tk-tree'}
      style={{ ...style, ['--tk-indent-width' as string]: `${indentWidth}px` }}
    >
      <div
        ref={viewportRef}
        className="tk-viewport"
        role="tree"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-multiselectable={multiSelect ? true : undefined}
        aria-activedescendant={activeDescendant}
        onKeyDown={onKeyDown}
      >
        <div
          ref={contentRef}
          className="tk-content"
          style={{ height: engines?.virtualizer.totalSize() ?? 0 }}
        >
          {rows.map(row => (
            <TkTreeRowView
              key={row.node.id}
              row={row}
              measuringVirtualizer={measuringVirtualizer}
              className={rowClassName(row, {
                hovered: row.node === hoveredFolder,
                active: row.node === activeNode && activeDescendant !== undefined,
                guides: indentGuides,
              })}
              indentWidth={indentWidth}
              onClick={event => onRowClick(row.node, event)}
              onDoubleClick={() => latest.current.onNodeDoubleClick?.(row.node)}
              onContextMenu={event => onContextMenu(row.node, event)}
              onToggle={event => onToggle(row.node, event)}
            >
              {renderNode ? (
                renderNode(row.node, { index: row.index, row })
              ) : (
                <span className="tk-name">{row.node.name}</span>
              )}
            </TkTreeRowView>
          ))}
          {insertionLine && (
            <div
              className="tk-insertion-line"
              style={{ top: insertionLine.top, left: insertionLine.left }}
            />
          )}
        </div>
        {placeholder !== null && <div className="tk-placeholder">{placeholder}</div>}
      </div>
      <div className="tk-live-region" aria-live="assertive" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}

function rowClassName<T>(
  row: TkTreeRow<T>,
  flags: { hovered: boolean; active: boolean; guides: boolean }
): string {
  let name = 'tk-node';
  if (row.selected) name += ' selected';
  if (flags.hovered) name += ' folder-hovered';
  if (flags.active) name += ' active';
  if (row.canDrag) name += ' draggable';
  if (flags.guides) name += ' tk-guides';
  return name;
}

interface TkTreeRowViewProps<T> {
  row: TkTreeRow<T>;
  measuringVirtualizer: TreeVirtualizer | null;
  className: string;
  indentWidth: number;
  children: ReactNode;
  onClick: (event: ReactMouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (event: ReactMouseEvent) => void;
  onToggle: (event: ReactMouseEvent) => void;
}

/**
 * One positioned row. Drag events are deliberately not bound here: the
 * `DndEngine` listens natively on the viewport and resolves the row from
 * `data-node-id`, so React handlers would double-handle every drag.
 */
function TkTreeRowView<T>({
  row,
  measuringVirtualizer,
  className,
  indentWidth,
  children,
  onClick,
  onDoubleClick,
  onContextMenu,
  onToggle,
}: TkTreeRowViewProps<T>): ReactElement {
  const rowRef = useRef<HTMLDivElement>(null);

  // Variable-height virtualizers need each row's laid-out size. Re-measurement
  // is the virtualizer's own job (TanStack observes every element it is
  // handed), so this only reports the element, and re-reports when the row is
  // recycled to a different index.
  useLayoutEffect(() => {
    if (rowRef.current) {
      measuringVirtualizer?.measure?.(rowRef.current, row.index);
    }
  }, [measuringVirtualizer, row.index]);

  const { node } = row;
  const level = node.level ?? 0;
  return (
    <div
      ref={rowRef}
      className="tk-row"
      style={{
        transform: `translateY(${row.start}px)`,
        height: measuringVirtualizer ? undefined : row.size,
        minHeight: measuringVirtualizer ? row.size : undefined,
      }}
    >
      <div
        className={className}
        role="treeitem"
        id={`tk-node-${node.id}`}
        aria-level={level + 1}
        aria-expanded={row.ariaExpanded}
        aria-selected={row.selected}
        data-node-id={node.id}
        draggable={row.canDrag}
        style={{
          paddingLeft: level * indentWidth,
          ['--tk-guide-width' as string]: `${level * indentWidth}px`,
        }}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
      >
        {row.expandable ? (
          node.isLoading ? (
            <span className="tk-spinner" />
          ) : (
            <button
              type="button"
              className={row.expanded ? 'tk-toggle expanded' : 'tk-toggle'}
              tabIndex={-1}
              aria-hidden="true"
              onClick={onToggle}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" focusable="false">
                <path
                  d="M6 4l4 4-4 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )
        ) : (
          <span className="tk-toggle-spacer" />
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * Virtualized tree with native HTML5 drag-and-drop and keyboard-accessible
 * DnD, rendered over a consumer-owned `TreeState` from `@treekit/core`.
 *
 * The component is a thin adapter: all tree logic (visibility, mutations,
 * filtering, drop resolution, keyboard semantics) lives in the headless core;
 * this component wires the engines to the DOM and renders rows, optionally
 * through `renderNode`. Import `@treekit/react/styles.css` once for the
 * default look, themed through `--tk-*` custom properties.
 *
 * Accessibility follows the `aria-activedescendant` pattern: the viewport
 * holds focus (`role="tree"`) and rows are `treeitem`s addressed by id.
 */
export const TkTree = forwardRef(TkTreeInner) as <T>(
  props: TkTreeProps<T> & { ref?: Ref<TkTreeHandle<T>> }
) => ReactElement;
