import type { DropEvent, DropMode, DropTarget, TreeNode } from '../tree/model';

/**
 * Resolves the drop intent from whether the hovered row is a folder and the
 * pointer's vertical fraction within it. Pure so it can be tested without
 * layout: the middle 50% of a folder means "drop inside"; otherwise the
 * pointer half selects before/after.
 */
export function resolveDropIntent(isFolder: boolean, fraction: number): DropMode {
  if (isFolder && fraction >= 0.25 && fraction <= 0.75) {
    return 'into';
  }
  return fraction < 0.5 ? 'before' : 'after';
}

/** Between-siblings insertion preview. */
export interface InsertionTarget<T> {
  node: TreeNode<T>;
  position: 'before' | 'after';
}

/** Pixel coordinates of the insertion line within the virtual content. */
export interface InsertionLine {
  top: number;
  left: number;
}

/** Configuration for a `DndEngine`. */
export interface DndEngineOptions<T> {
  /** Supplies the currently rendered nodes for `data-node-id` resolution. */
  getVisibleNodes: () => readonly TreeNode<T>[];
  /** Receives the resolved drop. */
  onDrop: (event: DropEvent<T>) => void;
  /** Fires when any feedback state (hover/insertion/dragging) changes. */
  onStateChange?: () => void;
  /** Disables all drag interactions while it returns `true`. */
  isDisabled?: () => boolean;
  /**
   * Validation hook consulted before showing feedback for a target — wire
   * `TreeState.canMove` here so invalid targets never light up. `node` is
   * `null` for external drags.
   */
  canDropAt?: (node: TreeNode<T> | null, target: DropTarget<T>) => boolean;
  /** Distance from the viewport edge that triggers auto-scroll. Default 36. */
  autoScrollEdge?: number;
  /** Auto-scroll speed in pixels per frame. Default 10. */
  autoScrollStep?: number;
  /** Indentation per tree level for the insertion line. Default 18. */
  indentWidth?: number;
  /** Base left inset of the insertion line. Default 8. */
  insetLeft?: number;
}

/**
 * Native HTML5 drag-and-drop engine for a virtualized tree.
 *
 * Rows are absolutely positioned by a virtualizer, which CDK-style flow-based
 * sorting fights (placeholders shift transforms, indices lie). This engine
 * never inserts anything into the layout: the drop target is resolved purely
 * from the pointer position via `elementFromPoint` against `[data-node-id]`
 * rows, and feedback is a folder highlight or a single overlay insertion line.
 *
 * In-tree drags start from rows (delegated `dragstart`); external sources
 * participate with plain `draggable` + `dataTransfer` and arrive as
 * `node: null` drops. A document-level `dragend` bound once per drag
 * guarantees feedback teardown even when the drag is aborted or dropped
 * outside the tree.
 */
export class DndEngine<T> {
  private readonly _options: DndEngineOptions<T>;
  private _viewport: HTMLElement | null = null;
  private _content: HTMLElement | null = null;
  private _document: Document | null = null;

  private _draggedNode: TreeNode<T> | null = null;
  private _dragActive = false;
  private _hoveredFolder: TreeNode<T> | null = null;
  private _insertionTarget: InsertionTarget<T> | null = null;
  private _insertionLine: InsertionLine | null = null;

  private _autoScrollDirection = 0;
  private _autoScrollFrame: number | null = null;
  private _releaseDragEnd: (() => void) | null = null;
  private _detachListeners: (() => void) | null = null;

  constructor(options: DndEngineOptions<T>) {
    this._options = options;
  }

  // MARK: - Feedback state

  /** Folder currently highlighted as an `into` target, or `null`. */
  hoveredFolder(): TreeNode<T> | null {
    return this._hoveredFolder;
  }

  /** Between-siblings target, or `null` while idle or over a folder. */
  insertionTarget(): InsertionTarget<T> | null {
    return this._insertionTarget;
  }

  /** Overlay coordinates for the insertion line, or `null`. */
  insertionLine(): InsertionLine | null {
    return this._insertionLine;
  }

  /** Whether a drag is in progress over (or from) this tree. */
  isDragging(): boolean {
    return this._dragActive;
  }

  /** The row being dragged for an in-tree drag; `null` for external drags. */
  draggedNode(): TreeNode<T> | null {
    return this._draggedNode;
  }

  /** Updates runtime-tunable options in place without re-attaching. */
  updateOptions(
    options: Partial<
      Pick<DndEngineOptions<T>, 'autoScrollEdge' | 'autoScrollStep' | 'indentWidth' | 'insetLeft'>
    >
  ): void {
    Object.assign(this._options, options);
  }

  // MARK: - Lifecycle

  /**
   * Binds the engine to the scroll viewport and the virtual content element
   * (the transformed container rows live in — insertion-line coordinates are
   * relative to it). Returns the detach function.
   */
  attach(viewport: HTMLElement, content: HTMLElement): () => void {
    this._viewport = viewport;
    this._content = content;
    this._document = viewport.ownerDocument;

    const handleDragStart = (event: Event): void => this._onDragStart(event as DragEvent);
    const handleDragOver = (event: Event): void => this._onDragOver(event as DragEvent);
    const handleDrop = (event: Event): void => this._onDrop(event as DragEvent);
    const handleDragLeave = (event: Event): void => this._onDragLeave(event as DragEvent);

    viewport.addEventListener('dragstart', handleDragStart);
    viewport.addEventListener('dragover', handleDragOver);
    viewport.addEventListener('drop', handleDrop);
    viewport.addEventListener('dragleave', handleDragLeave);

    this._detachListeners = () => {
      viewport.removeEventListener('dragstart', handleDragStart);
      viewport.removeEventListener('dragover', handleDragOver);
      viewport.removeEventListener('drop', handleDrop);
      viewport.removeEventListener('dragleave', handleDragLeave);
    };

    return () => this.detach();
  }

  /** Unbinds all listeners and clears any in-flight drag state. */
  detach(): void {
    this._endDrag(false);
    this._detachListeners?.();
    this._detachListeners = null;
    this._viewport = null;
    this._content = null;
    this._document = null;
  }

  // MARK: - Event handling

  /** Delegated `dragstart` from a row: begins an in-tree drag when allowed. */
  private _onDragStart(event: DragEvent): void {
    const node = this._nodeFromEvent(event);
    if (!node || this._options.isDisabled?.() || node.canDrag === false) {
      event.preventDefault();
      return;
    }
    this._draggedNode = node;
    this._beginDrag();
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'all';
      event.dataTransfer.setData('text/plain', node.name);
    }
    this._notify();
  }

  private _onDragOver(event: DragEvent): void {
    if (!this._detachListeners || this._options.isDisabled?.()) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this._beginDrag();
    this._resolveDropTarget(event.clientX, event.clientY);
    this._updateAutoScroll(event.clientY);
  }

  private _onDrop(event: DragEvent): void {
    if (this._options.isDisabled?.()) {
      return;
    }
    event.preventDefault();
    this._options.onDrop({
      node: this._draggedNode,
      target: this._currentTarget(),
      dataTransfer: event.dataTransfer,
    });
    this._endDrag(true);
  }

  /** Hides the indicators when the pointer leaves the viewport (the drag may continue elsewhere). */
  private _onDragLeave(event: DragEvent): void {
    const related = event.relatedTarget as Node | null;
    if (this._viewport && related && this._viewport.contains(related)) {
      return;
    }
    this._autoScrollDirection = 0;
    this._setFeedback(null, null, null);
  }

  // MARK: - Target resolution

  private _currentTarget(): DropTarget<T> | null {
    if (this._hoveredFolder) {
      return { node: this._hoveredFolder, mode: 'into' };
    }
    if (this._insertionTarget) {
      return { node: this._insertionTarget.node, mode: this._insertionTarget.position };
    }
    return null;
  }

  /** Hit-tests the pointer against the rows and updates the feedback state. */
  private _resolveDropTarget(x: number, y: number): void {
    let hovered: TreeNode<T> | null = null;
    let insertion: InsertionTarget<T> | null = null;
    let line: InsertionLine | null = null;

    const rowElement = this._rowFromPoint(x, y);
    if (rowElement) {
      const nodeId = rowElement.getAttribute('data-node-id');
      const node = this._options.getVisibleNodes().find(candidate => candidate.id === nodeId);
      if (node && node !== this._draggedNode) {
        const rect = rowElement.getBoundingClientRect();
        const fraction = rect.height > 0 ? (y - rect.top) / rect.height : 0;
        const intent = resolveDropIntent(!!node.isFolder, fraction);
        const target: DropTarget<T> = { node, mode: intent };
        if (this._options.canDropAt?.(this._draggedNode, target) !== false) {
          if (intent === 'into') {
            hovered = node;
          } else {
            insertion = { node, position: intent };
            line = this._computeInsertionLine(rect, intent, node);
          }
        }
      }
    }

    this._setFeedback(hovered, insertion, line);
  }

  private _rowFromPoint(x: number, y: number): HTMLElement | null {
    const element = this._document?.elementFromPoint(x, y);
    return (element?.closest('[data-node-id]') as HTMLElement | null) ?? null;
  }

  /** Computes the insertion line position relative to the virtual content. */
  private _computeInsertionLine(
    rowRect: DOMRect,
    position: 'before' | 'after',
    node: TreeNode<T>
  ): InsertionLine | null {
    const content = this._content;
    if (!content) {
      return null;
    }
    const contentRect = content.getBoundingClientRect();
    const top = (position === 'before' ? rowRect.top : rowRect.bottom) - contentRect.top;
    const indentWidth = this._options.indentWidth ?? 18;
    const insetLeft = this._options.insetLeft ?? 8;
    return { top, left: node.level * indentWidth + insetLeft };
  }

  // MARK: - Auto-scroll

  /** Updates the auto-scroll direction from the pointer's distance to the viewport edges. */
  private _updateAutoScroll(pointerY: number): void {
    const viewport = this._viewport;
    if (!viewport) {
      return;
    }
    const rect = viewport.getBoundingClientRect();
    const edge = this._options.autoScrollEdge ?? 36;
    if (pointerY < rect.top + edge) {
      this._autoScrollDirection = -1;
    } else if (pointerY > rect.bottom - edge) {
      this._autoScrollDirection = 1;
    } else {
      this._autoScrollDirection = 0;
    }
    if (this._autoScrollDirection !== 0) {
      this._startAutoScroll();
    }
  }

  /** Runs the auto-scroll loop until the direction returns to zero. */
  private _startAutoScroll(): void {
    if (this._autoScrollFrame !== null) {
      return;
    }
    const step = (): void => {
      if (this._autoScrollDirection === 0 || !this._viewport) {
        this._autoScrollFrame = null;
        return;
      }
      this._viewport.scrollTop += this._autoScrollDirection * (this._options.autoScrollStep ?? 10);
      this._autoScrollFrame = requestAnimationFrame(step);
    };
    this._autoScrollFrame = requestAnimationFrame(step);
  }

  // MARK: - Drag lifecycle

  /**
   * Marks a drag as active and binds the release listener exactly once —
   * whether the drag started from a row (`dragstart`) or entered from an
   * external source (`dragover`).
   */
  private _beginDrag(): void {
    if (this._dragActive) {
      return;
    }
    this._dragActive = true;
    const release = (): void => this._endDrag(true);
    this._document?.addEventListener('dragend', release);
    this._releaseDragEnd = () => this._document?.removeEventListener('dragend', release);
    this._notify();
  }

  /**
   * Clears all drag state and tears down the release listener and auto-scroll
   * loop. Runs on drop, on the guaranteed document `dragend`, and on detach.
   */
  private _endDrag(notify: boolean): void {
    const hadState =
      this._dragActive ||
      this._hoveredFolder !== null ||
      this._insertionTarget !== null ||
      this._draggedNode !== null;
    this._draggedNode = null;
    this._dragActive = false;
    this._autoScrollDirection = 0;
    if (this._autoScrollFrame !== null) {
      cancelAnimationFrame(this._autoScrollFrame);
      this._autoScrollFrame = null;
    }
    this._hoveredFolder = null;
    this._insertionTarget = null;
    this._insertionLine = null;
    this._releaseDragEnd?.();
    this._releaseDragEnd = null;
    if (notify && hadState) {
      this._notify();
    }
  }

  // MARK: - Helpers

  private _nodeFromEvent(event: DragEvent): TreeNode<T> | null {
    const target = event.target as HTMLElement | null;
    const row = target?.closest('[data-node-id]') as HTMLElement | null;
    if (!row) {
      return null;
    }
    const nodeId = row.getAttribute('data-node-id');
    return this._options.getVisibleNodes().find(candidate => candidate.id === nodeId) ?? null;
  }

  /** Applies feedback state, notifying only when something actually changed. */
  private _setFeedback(
    hovered: TreeNode<T> | null,
    insertion: InsertionTarget<T> | null,
    line: InsertionLine | null
  ): void {
    const changed =
      hovered !== this._hoveredFolder ||
      insertion?.node !== this._insertionTarget?.node ||
      insertion?.position !== this._insertionTarget?.position ||
      line?.top !== this._insertionLine?.top ||
      line?.left !== this._insertionLine?.left;
    this._hoveredFolder = hovered;
    this._insertionTarget = insertion;
    this._insertionLine = line;
    if (changed) {
      this._notify();
    }
  }

  private _notify(): void {
    this._options.onStateChange?.();
  }
}
