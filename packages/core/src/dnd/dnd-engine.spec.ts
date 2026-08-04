import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DropEvent, TreeNode } from '../tree/model';
import { DndEngine, resolveDropIntent } from './dnd-engine';

const ROW_HEIGHT = 30;
const VIEWPORT_HEIGHT = 300;

interface NodeSpec {
  id: string;
  isFolder?: boolean;
  canDrag?: boolean;
  level?: number;
  /** Id of the parent row, for tests that need real ancestry. */
  parent?: string;
}

interface Harness {
  viewport: HTMLElement;
  content: HTMLElement;
  rows: Map<string, HTMLElement>;
  nodes: TreeNode<string>[];
  engine: DndEngine<string>;
  drops: DropEvent<string>[];
  stateChanges: () => number;
  detach: () => void;
}

function mockRect(element: HTMLElement, rect: Partial<DOMRect>): void {
  element.getBoundingClientRect = () =>
    ({
      width: 200,
      height: 0,
      top: 0,
      left: 0,
      right: 200,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...rect,
    }) as DOMRect;
}

function createHarness(
  specs: NodeSpec[],
  engineOptions: Partial<ConstructorParameters<typeof DndEngine<string>>[0]> = {}
): Harness {
  const viewport = document.createElement('div');
  mockRect(viewport, { top: 0, bottom: VIEWPORT_HEIGHT, height: VIEWPORT_HEIGHT });
  Object.defineProperty(viewport, 'clientHeight', { value: VIEWPORT_HEIGHT, configurable: true });
  const content = document.createElement('div');
  mockRect(content, {
    top: 0,
    bottom: specs.length * ROW_HEIGHT,
    height: specs.length * ROW_HEIGHT,
  });
  viewport.appendChild(content);
  document.body.appendChild(viewport);

  const nodes: TreeNode<string>[] = specs.map(spec => ({
    id: spec.id,
    item: spec.id,
    name: spec.id,
    level: spec.level ?? 0,
    parent: null,
    isFolder: spec.isFolder,
    canDrag: spec.canDrag,
  }));

  const byId = new Map(nodes.map(node => [node.id, node]));
  specs.forEach((spec, index) => {
    const parent = spec.parent ? byId.get(spec.parent) : undefined;
    if (parent) {
      const node = nodes[index]!;
      node.parent = parent;
      (parent.children ??= []).push(node);
    }
  });

  const rows = new Map<string, HTMLElement>();
  specs.forEach((spec, index) => {
    const row = document.createElement('div');
    row.setAttribute('data-node-id', spec.id);
    mockRect(row, {
      top: index * ROW_HEIGHT,
      bottom: (index + 1) * ROW_HEIGHT,
      height: ROW_HEIGHT,
    });
    content.appendChild(row);
    rows.set(spec.id, row);
  });

  document.elementFromPoint = (x: number, y: number): Element | null => {
    if (x < 0 || x > 200) {
      return null;
    }
    const index = Math.floor(y / ROW_HEIGHT);
    const spec = specs[index];
    return spec ? (rows.get(spec.id) ?? null) : null;
  };

  const drops: DropEvent<string>[] = [];
  let stateChangeCount = 0;
  const engine = new DndEngine<string>({
    getVisibleNodes: () => nodes,
    onDrop: event => drops.push(event),
    onStateChange: () => stateChangeCount++,
    ...engineOptions,
  });
  const detach = engine.attach(viewport, content);

  return {
    viewport,
    content,
    rows,
    nodes,
    engine,
    drops,
    stateChanges: () => stateChangeCount,
    detach,
  };
}

interface SyntheticDragOptions {
  x?: number;
  y?: number;
  dataTransfer?: unknown;
  relatedTarget?: Element | null;
}

function fireDrag(target: Element, type: string, options: SyntheticDragOptions = {}): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    clientX: options.x ?? 100,
    clientY: options.y ?? 0,
    dataTransfer: options.dataTransfer ?? {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
      getData: vi.fn(),
    },
  });
  if (options.relatedTarget !== undefined) {
    Object.defineProperty(event, 'relatedTarget', { value: options.relatedTarget });
  }
  target.dispatchEvent(event);
  return event;
}

describe('resolveDropIntent', () => {
  it('drops into a folder across its middle band', () => {
    expect(resolveDropIntent(true, 0.25)).toBe('into');
    expect(resolveDropIntent(true, 0.5)).toBe('into');
    expect(resolveDropIntent(true, 0.75)).toBe('into');
  });

  it('inserts before/after at a folder edge', () => {
    expect(resolveDropIntent(true, 0.1)).toBe('before');
    expect(resolveDropIntent(true, 0.9)).toBe('after');
  });

  it('splits a leaf at the midpoint', () => {
    expect(resolveDropIntent(false, 0.49)).toBe('before');
    expect(resolveDropIntent(false, 0.51)).toBe('after');
  });
});

describe('DndEngine', () => {
  let harness: Harness;

  afterEach(() => {
    harness.detach();
    harness.viewport.remove();
    vi.unstubAllGlobals();
  });

  describe('drag start', () => {
    beforeEach(() => {
      harness = createHarness([
        { id: 'folder', isFolder: true },
        { id: 'leaf' },
        { id: 'locked', canDrag: false },
      ]);
    });

    it('begins an in-tree drag from a draggable row', () => {
      fireDrag(harness.rows.get('leaf')!, 'dragstart', { y: 45 });
      expect(harness.engine.isDragging()).toBe(true);
      expect(harness.engine.draggedNode()?.id).toBe('leaf');
    });

    it('prevents dragging a canDrag:false row', () => {
      const event = fireDrag(harness.rows.get('locked')!, 'dragstart', { y: 75 });
      expect(event.defaultPrevented).toBe(true);
      expect(harness.engine.isDragging()).toBe(false);
    });

    it('prevents dragging entirely when disabled', () => {
      harness.detach();
      harness.viewport.remove();
      harness = createHarness([{ id: 'leaf' }], { isDisabled: () => true });
      const event = fireDrag(harness.rows.get('leaf')!, 'dragstart', { y: 15 });
      expect(event.defaultPrevented).toBe(true);
      expect(harness.engine.isDragging()).toBe(false);
    });
  });

  describe('drag over', () => {
    beforeEach(() => {
      harness = createHarness([
        { id: 'folder', isFolder: true },
        { id: 'leaf', level: 1 },
        { id: 'other' },
      ]);
    });

    it('highlights a folder when hovering its middle and allows the drop', () => {
      const event = fireDrag(harness.viewport, 'dragover', { y: 15 });
      expect(event.defaultPrevented).toBe(true);
      expect(harness.engine.hoveredFolder()?.id).toBe('folder');
      expect(harness.engine.insertionTarget()).toBeNull();
    });

    it('shows an indented insertion line in a leaf top half', () => {
      fireDrag(harness.viewport, 'dragover', { y: 32 });
      expect(harness.engine.hoveredFolder()).toBeNull();
      expect(harness.engine.insertionTarget()).toEqual(
        expect.objectContaining({ position: 'before' })
      );
      expect(harness.engine.insertionTarget()?.node.id).toBe('leaf');
      expect(harness.engine.insertionLine()).toEqual({ top: 30, left: 1 * 18 + 8 });
    });

    it('applies updated indentation options to later insertion lines', () => {
      harness.engine.updateOptions({ indentWidth: 30, insetLeft: 2 });
      fireDrag(harness.viewport, 'dragover', { y: 32 });
      expect(harness.engine.insertionLine()).toEqual({ top: 30, left: 1 * 30 + 2 });
    });

    it('places the line under a leaf bottom half', () => {
      fireDrag(harness.viewport, 'dragover', { y: 55 });
      expect(harness.engine.insertionTarget()).toEqual(
        expect.objectContaining({ position: 'after' })
      );
      expect(harness.engine.insertionLine()?.top).toBe(60);
    });

    it('offers no feedback over the row being dragged', () => {
      fireDrag(harness.rows.get('other')!, 'dragstart', { y: 75 });
      fireDrag(harness.viewport, 'dragover', { y: 75 });
      expect(harness.engine.hoveredFolder()).toBeNull();
      expect(harness.engine.insertionTarget()).toBeNull();
    });

    it('offers no feedback when the validation hook rejects the target', () => {
      harness.detach();
      harness.viewport.remove();
      harness = createHarness([{ id: 'folder', isFolder: true }], { canDropAt: () => false });
      fireDrag(harness.viewport, 'dragover', { y: 15 });
      expect(harness.engine.hoveredFolder()).toBeNull();
    });

    it('ignores dragover while disabled', () => {
      harness.detach();
      harness.viewport.remove();
      harness = createHarness([{ id: 'folder', isFolder: true }], { isDisabled: () => true });
      const event = fireDrag(harness.viewport, 'dragover', { y: 15 });
      expect(event.defaultPrevented).toBe(false);
      expect(harness.engine.hoveredFolder()).toBeNull();
    });

    it('notifies state changes only when feedback actually changes', () => {
      fireDrag(harness.viewport, 'dragover', { y: 15 });
      const afterFirst = harness.stateChanges();
      fireDrag(harness.viewport, 'dragover', { y: 16 });
      expect(harness.stateChanges()).toBe(afterFirst);
    });
  });

  describe('drop', () => {
    beforeEach(() => {
      harness = createHarness([{ id: 'folder', isFolder: true }, { id: 'leaf' }, { id: 'other' }]);
    });

    it('emits the dragged node with the resolved folder target and clears feedback', () => {
      fireDrag(harness.rows.get('leaf')!, 'dragstart', { y: 45 });
      fireDrag(harness.viewport, 'dragover', { y: 15 });
      fireDrag(harness.viewport, 'drop', { y: 15 });

      expect(harness.drops).toHaveLength(1);
      expect(harness.drops[0]!.node?.id).toBe('leaf');
      expect(harness.drops[0]!.target).toEqual(expect.objectContaining({ mode: 'into' }));
      expect(harness.drops[0]!.target?.node.id).toBe('folder');
      expect(harness.engine.isDragging()).toBe(false);
      expect(harness.engine.hoveredFolder()).toBeNull();
    });

    it('emits a null node for an external drag and passes the dataTransfer through', () => {
      const dataTransfer = { getData: vi.fn(() => 'payload'), setData: vi.fn() };
      fireDrag(harness.viewport, 'dragover', { y: 45, dataTransfer });
      fireDrag(harness.viewport, 'drop', { y: 45, dataTransfer });

      expect(harness.drops[0]!.node).toBeNull();
      expect(harness.drops[0]!.target?.node.id).toBe('leaf');
      expect(harness.drops[0]!.dataTransfer).toBe(dataTransfer);
    });

    it('emits a null target when released over empty space', () => {
      fireDrag(harness.viewport, 'dragover', { y: 250 });
      fireDrag(harness.viewport, 'drop', { y: 250 });
      expect(harness.drops[0]!.target).toBeNull();
    });
  });

  describe('teardown', () => {
    beforeEach(() => {
      harness = createHarness([{ id: 'folder', isFolder: true }, { id: 'leaf' }]);
    });

    it('clears feedback when the pointer leaves the viewport but keeps the drag alive', () => {
      fireDrag(harness.viewport, 'dragover', { y: 15 });
      fireDrag(harness.viewport, 'dragleave', { relatedTarget: document.body });
      expect(harness.engine.hoveredFolder()).toBeNull();
      expect(harness.engine.isDragging()).toBe(true);
    });

    it('keeps feedback when dragleave moves to a child of the viewport', () => {
      fireDrag(harness.viewport, 'dragover', { y: 15 });
      fireDrag(harness.viewport, 'dragleave', {
        relatedTarget: harness.rows.get('folder')!,
      });
      expect(harness.engine.hoveredFolder()?.id).toBe('folder');
    });

    it('resets everything on document dragend even without a drop', () => {
      fireDrag(harness.rows.get('leaf')!, 'dragstart', { y: 45 });
      fireDrag(harness.viewport, 'dragover', { y: 15 });
      document.dispatchEvent(new Event('dragend'));
      expect(harness.engine.isDragging()).toBe(false);
      expect(harness.engine.hoveredFolder()).toBeNull();
      expect(harness.engine.draggedNode()).toBeNull();
    });

    it('stops reacting after detach', () => {
      harness.detach();
      const event = fireDrag(harness.viewport, 'dragover', { y: 15 });
      expect(event.defaultPrevented).toBe(false);
      expect(harness.engine.hoveredFolder()).toBeNull();
    });
  });

  describe('auto-scroll', () => {
    it('scrolls the viewport while hovering near the bottom edge and stops on dragend', () => {
      const frames: FrameRequestCallback[] = [];
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
        frames.push(callback);
        return frames.length;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());

      harness = createHarness(
        Array.from({ length: 20 }, (_, index) => ({ id: `row-${index}` })),
        { autoScrollStep: 10 }
      );
      harness.viewport.scrollTop = 0;

      fireDrag(harness.viewport, 'dragover', { y: VIEWPORT_HEIGHT - 5 });
      expect(frames.length).toBeGreaterThan(0);

      frames.shift()!(0);
      expect(harness.viewport.scrollTop).toBe(10);
      frames.shift()!(0);
      expect(harness.viewport.scrollTop).toBe(20);

      document.dispatchEvent(new Event('dragend'));
      const pending = frames.length;
      while (frames.length > 0) {
        frames.shift()!(0);
      }
      expect(pending).toBeLessThanOrEqual(1);
      expect(harness.viewport.scrollTop).toBe(20);
    });
  });
});

describe('DndEngine multi-node drag', () => {
  /**
   * a (folder)
   *   a1
   * b
   * c
   */
  const SPECS: NodeSpec[] = [
    { id: 'a', isFolder: true },
    { id: 'a1', parent: 'a', level: 1 },
    { id: 'b' },
    { id: 'c' },
  ];

  let harness: Harness;
  let selectedIds: string[];
  let resets: TreeNode<string>[];

  function setup(options: Partial<ConstructorParameters<typeof DndEngine<string>>[0]> = {}): void {
    harness = createHarness(SPECS, {
      getSelectedNodes: () => harness.nodes.filter(node => selectedIds.includes(node.id)),
      onDragSelectionReset: node => resets.push(node),
      ...options,
    });
  }

  /** Vertical centre of the row at `index`. */
  function rowCentre(index: number): number {
    return index * ROW_HEIGHT + ROW_HEIGHT / 2;
  }

  function dragIds(): string[] {
    return harness.engine.draggedNodes().map(node => node.id);
  }

  beforeEach(() => {
    selectedIds = [];
    resets = [];
  });

  afterEach(() => {
    harness.detach();
    harness.viewport.remove();
  });

  it('drags the whole selection when the grabbed row is part of it', () => {
    selectedIds = ['b', 'c'];
    setup();

    fireDrag(harness.rows.get('b')!, 'dragstart');

    expect(dragIds()).toEqual(['b', 'c']);
    expect(resets).toEqual([]);
  });

  it('collapses the selection and drags one row when the grabbed row is outside it', () => {
    selectedIds = ['b', 'c'];
    setup();

    fireDrag(harness.rows.get('a')!, 'dragstart');

    expect(dragIds()).toEqual(['a']);
    expect(resets.map(node => node.id)).toEqual(['a']);
  });

  it('normalizes the payload to document order and de-nests it', () => {
    selectedIds = ['a1', 'a'];
    setup();

    fireDrag(harness.rows.get('a')!, 'dragstart');

    // `a1` rides inside `a`, so it must not be dragged independently.
    expect(dragIds()).toEqual(['a']);
  });

  it('shows no drop feedback over any dragged row', () => {
    selectedIds = ['b', 'c'];
    setup();
    fireDrag(harness.rows.get('b')!, 'dragstart');

    fireDrag(harness.viewport, 'dragover', { y: rowCentre(3) });

    expect(harness.engine.hoveredFolder()).toBeNull();
    expect(harness.engine.insertionTarget()).toBeNull();
  });

  it('excludes descendants of dragged rows structurally, not via canDropAt', () => {
    selectedIds = ['a'];
    // Permissive validation: any exclusion here must come from the engine.
    setup({ canDropAt: () => true });
    fireDrag(harness.rows.get('a')!, 'dragstart');

    fireDrag(harness.viewport, 'dragover', { y: rowCentre(1) });

    expect(harness.engine.hoveredFolder()).toBeNull();
    expect(harness.engine.insertionTarget()).toBeNull();
  });

  it('passes the whole payload to canDropAt', () => {
    const seen: string[][] = [];
    selectedIds = ['b', 'c'];
    setup({
      canDropAt: nodes => {
        seen.push(nodes.map(node => node.id));
        return true;
      },
    });
    fireDrag(harness.rows.get('b')!, 'dragstart');

    fireDrag(harness.viewport, 'dragover', { y: rowCentre(0) });

    expect(seen.at(-1)).toEqual(['b', 'c']);
  });

  it('emits every dragged node on drop, with node as the first of them', () => {
    selectedIds = ['c', 'b'];
    setup();
    fireDrag(harness.rows.get('b')!, 'dragstart');
    fireDrag(harness.viewport, 'dragover', { y: rowCentre(0) });

    fireDrag(harness.viewport, 'drop', { y: rowCentre(0) });

    const drop = harness.drops[0]!;
    expect(drop.nodes.map(node => node.id)).toEqual(['b', 'c']);
    expect(drop.node).toBe(drop.nodes[0]);
  });

  it('reports an external drag as no nodes at all', () => {
    setup();

    fireDrag(harness.viewport, 'dragover', { y: rowCentre(2) });
    fireDrag(harness.viewport, 'drop', { y: rowCentre(2) });

    const drop = harness.drops[0]!;
    expect(drop.node).toBeNull();
    expect(drop.nodes).toEqual([]);
  });

  it('writes the joined names as the transfer text, and honours a dragText override', () => {
    selectedIds = ['b', 'c'];
    setup();
    const dataTransfer = { effectAllowed: '', dropEffect: '', setData: vi.fn(), getData: vi.fn() };

    fireDrag(harness.rows.get('b')!, 'dragstart', { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'b, c');

    harness.detach();
    harness.viewport.remove();
    setup({ dragText: nodes => `${nodes.length} items` });
    const custom = { effectAllowed: '', dropEffect: '', setData: vi.fn(), getData: vi.fn() };

    fireDrag(harness.rows.get('b')!, 'dragstart', { dataTransfer: custom });
    expect(custom.setData).toHaveBeenCalledWith('text/plain', '2 items');
  });

  it('falls back to the grabbed row when normalization empties the payload', () => {
    harness = createHarness([{ id: 'locked', canDrag: false }, { id: 'free' }], {
      getSelectedNodes: () => harness.nodes.filter(node => node.id === 'free'),
    });

    // `free` is selected, so the whole selection would normally travel — but a
    // drag starting on `locked` is rejected before that, by canDrag.
    const event = fireDrag(harness.rows.get('locked')!, 'dragstart');

    expect(event.defaultPrevented).toBe(true);
    expect(dragIds()).toEqual([]);
  });
});

describe('DndEngine spring loading and drag handles', () => {
  let harness: Harness;

  afterEach(() => {
    harness.detach();
    harness.viewport.remove();
    vi.useRealTimers();
  });

  function rowCentre(index: number): number {
    return index * ROW_HEIGHT + ROW_HEIGHT / 2;
  }

  it('expands a collapsed folder after it has been hovered long enough', () => {
    vi.useFakeTimers();
    const sprung: string[] = [];
    harness = createHarness([{ id: 'folder', isFolder: true }, { id: 'leaf' }], {
      springLoadDelay: 400,
      onSpringLoad: node => sprung.push(node.id),
    });

    fireDrag(harness.viewport, 'dragover', { y: rowCentre(0) });
    vi.advanceTimersByTime(399);
    expect(sprung).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(sprung).toEqual(['folder']);
  });

  it('does not restart the timer while the pointer sits on the same folder', () => {
    vi.useFakeTimers();
    const sprung: string[] = [];
    harness = createHarness([{ id: 'folder', isFolder: true }], {
      springLoadDelay: 400,
      onSpringLoad: node => sprung.push(node.id),
    });

    // A stationary pointer still produces a stream of dragover events.
    for (let step = 0; step < 8; step++) {
      fireDrag(harness.viewport, 'dragover', { y: rowCentre(0) });
      vi.advanceTimersByTime(50);
    }

    expect(sprung).toEqual(['folder']);
  });

  it('cancels the pending expand when the pointer moves off the folder', () => {
    vi.useFakeTimers();
    const sprung: string[] = [];
    harness = createHarness([{ id: 'folder', isFolder: true }, { id: 'leaf' }], {
      springLoadDelay: 400,
      onSpringLoad: node => sprung.push(node.id),
    });

    fireDrag(harness.viewport, 'dragover', { y: rowCentre(0) });
    vi.advanceTimersByTime(200);
    fireDrag(harness.viewport, 'dragover', { y: rowCentre(1) });
    vi.advanceTimersByTime(400);

    expect(sprung).toEqual([]);
  });

  it('never springs an already-expanded folder', () => {
    vi.useFakeTimers();
    const sprung: string[] = [];
    harness = createHarness([{ id: 'folder', isFolder: true }], {
      springLoadDelay: 400,
      onSpringLoad: node => sprung.push(node.id),
    });
    harness.nodes[0]!.isExpanded = true;

    fireDrag(harness.viewport, 'dragover', { y: rowCentre(0) });
    vi.advanceTimersByTime(1000);

    expect(sprung).toEqual([]);
  });

  it('stays off when no delay is configured', () => {
    vi.useFakeTimers();
    const sprung: string[] = [];
    harness = createHarness([{ id: 'folder', isFolder: true }], {
      onSpringLoad: node => sprung.push(node.id),
    });

    fireDrag(harness.viewport, 'dragover', { y: rowCentre(0) });
    vi.advanceTimersByTime(5000);

    expect(sprung).toEqual([]);
  });

  it('starts a drag only from a handle when one is configured', () => {
    harness = createHarness([{ id: 'leaf' }], { dragHandleSelector: '.grip' });
    const row = harness.rows.get('leaf')!;
    const grip = document.createElement('span');
    grip.className = 'grip';
    row.appendChild(grip);

    const fromRow = fireDrag(row, 'dragstart');
    expect(fromRow.defaultPrevented).toBe(true);
    expect(harness.engine.isDragging()).toBe(false);

    const fromGrip = fireDrag(grip, 'dragstart');
    expect(fromGrip.defaultPrevented).toBe(false);
    expect(harness.engine.draggedNode()?.id).toBe('leaf');
  });
});
