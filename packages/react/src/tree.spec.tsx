import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  DropEvent,
  TreeInput,
  TreeNode,
  TreeState,
  TreeVirtualizer,
  VirtualItem,
} from '@constantine-24/treekit-core';
import { createRef, StrictMode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TkTree, TkTreeHandle, TkTreeProps } from './tree';

const ROW_HEIGHT = 30;

/** Renders every row — jsdom has no layout, so real virtualization is stubbed. */
class StubVirtualizer implements TreeVirtualizer {
  scrolledTo: number[] = [];
  attachCount = 0;
  detachCount = 0;
  private _count = 0;
  private _onChange: (() => void) | null = null;

  attach(_viewport: HTMLElement, onChange: () => void): () => void {
    this.attachCount++;
    this._onChange = onChange;
    return () => {
      this.detachCount++;
      this._onChange = null;
    };
  }

  setCount(count: number): void {
    if (count !== this._count) {
      this._count = count;
      this._onChange?.();
    }
  }

  totalSize(): number {
    return this._count * ROW_HEIGHT;
  }

  items(): readonly VirtualItem[] {
    return Array.from({ length: this._count }, (_, index) => ({
      index,
      start: index * ROW_HEIGHT,
      size: ROW_HEIGHT,
    }));
  }

  scrollToIndex(index: number): void {
    this.scrolledTo.push(index);
  }
}

/** Stub that measures, exercising the variable-height path. */
class MeasuringStubVirtualizer extends StubVirtualizer {
  readonly measured: { index: number; className: string }[] = [];

  measure(element: HTMLElement, index: number): void {
    this.measured.push({ index, className: element.className });
  }
}

function fixtureSource(): TreeInput<string>[] {
  return [
    {
      id: 'a',
      name: 'Alpha',
      item: 'A',
      isFolder: true,
      children: [{ id: 'a1', name: 'Alpha One', item: 'A1' }],
    },
    { id: 'b', name: 'Beta', item: 'B', isFolder: true, children: [] },
    { id: 'c', name: 'Gamma', item: 'C' },
  ];
}

function createState(): TreeState<string> {
  const state = new TreeState<string>();
  state.setSource(fixtureSource());
  return state;
}

function setup(props: Partial<TkTreeProps<string>> = {}) {
  const state = props.state ?? createState();
  const virtualizer = (props.virtualizer as StubVirtualizer | undefined) ?? new StubVirtualizer();
  const ref = createRef<TkTreeHandle<string>>();
  const allProps: TkTreeProps<string> = {
    ariaLabel: 'Demo tree',
    ...props,
    state,
    virtualizer,
  };
  const result = render(<TkTree ref={ref} {...allProps} />);
  return {
    ...result,
    state,
    virtualizer,
    ref,
    rerenderWith: (next: Partial<TkTreeProps<string>>) =>
      result.rerender(<TkTree ref={ref} {...allProps} {...next} />),
  };
}

function rowTexts(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.tk-node')).map(node =>
    node.textContent!.trim()
  );
}

function viewport(container: HTMLElement): HTMLElement {
  return container.querySelector('.tk-viewport')!;
}

function nodeElement(container: HTMLElement, id: string): HTMLElement {
  return container.querySelector(`[data-node-id="${id}"]`)!;
}

function selectedRowIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.tk-node.selected')).map(node =>
    node.getAttribute('data-node-id')!
  );
}

function pressKey(container: HTMLElement, key: string, init: KeyboardEventInit = {}): void {
  fireEvent.keyDown(viewport(container), { key, ...init });
}

describe('TkTree', () => {
  it('renders rows on first paint and sizes the content to the virtualizer', () => {
    const { container } = setup();

    expect(rowTexts(container)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(container.querySelector<HTMLElement>('.tk-content')!.style.height).toBe(
      `${3 * ROW_HEIGHT}px`
    );
  });

  /**
   * Guards the "engines attach, but the view never refreshes" failure class:
   * the mutation happens outside `act()`, so only the external-store
   * subscription can bring the new rows to the screen.
   */
  it('re-renders on its own when the TreeState changes outside React', async () => {
    const { state } = setup();

    state.expand(state.findById('a')!);

    expect(await screen.findByText('Alpha One')).toBeTruthy();
  });

  it('pins row height when the virtualizer does not measure', () => {
    const { container } = setup();
    const row = container.querySelector<HTMLElement>('.tk-row')!;

    expect(row.style.height).toBe(`${ROW_HEIGHT}px`);
    expect(row.style.minHeight).toBe('');
  });

  it('reports rendered rows to a measuring virtualizer and leaves their height free', () => {
    const virtualizer = new MeasuringStubVirtualizer();
    const { container } = setup({ virtualizer });

    expect(virtualizer.measured.map(entry => entry.index)).toEqual([0, 1, 2]);
    expect(virtualizer.measured.every(entry => entry.className.includes('tk-row'))).toBe(true);

    // A measured row must not carry a pinned height, or the estimate would be
    // fed straight back as the measurement.
    const row = container.querySelector<HTMLElement>('.tk-row')!;
    expect(row.style.height).toBe('');
    expect(row.style.minHeight).toBe(`${ROW_HEIGHT}px`);
  });

  it('renders the visible rows with default name templates', () => {
    const { container } = setup();
    expect(rowTexts(container)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('renders custom nodes with node and index context', () => {
    const { container } = setup({
      renderNode: (node, { index }) => (
        <span className="custom-cell">
          {index}:{node.name.toUpperCase()}
        </span>
      ),
    });
    const cells = Array.from(container.querySelectorAll('.custom-cell')).map(
      cell => cell.textContent
    );
    expect(cells).toEqual(['0:ALPHA', '1:BETA', '2:GAMMA']);
  });

  it('expands a folder from its toggle button and reflects state changes', () => {
    const { container } = setup();
    fireEvent.click(nodeElement(container, 'a').querySelector('.tk-toggle')!);

    expect(rowTexts(container)).toEqual(['Alpha', 'Alpha One', 'Beta', 'Gamma']);
    expect(nodeElement(container, 'a').getAttribute('aria-expanded')).toBe('true');
  });

  it('emits onNodeClick and moves the active descendant to the clicked row', () => {
    const onNodeClick = vi.fn<(node: TreeNode<string>) => void>();
    const { container } = setup({ onNodeClick });
    fireEvent.click(nodeElement(container, 'c'));

    expect(onNodeClick.mock.calls.map(([node]) => node.id)).toEqual(['c']);
    expect(viewport(container).getAttribute('aria-activedescendant')).toBe('tk-node-c');
  });

  it('emits onNodeDoubleClick and onNodeContextMenu', () => {
    const onNodeDoubleClick = vi.fn<(node: TreeNode<string>) => void>();
    const onNodeContextMenu =
      vi.fn<(payload: { event: MouseEvent; node: TreeNode<string> }) => void>();
    const { container } = setup({ onNodeDoubleClick, onNodeContextMenu });

    fireEvent.doubleClick(nodeElement(container, 'b'));
    const contextMenu = fireEvent.contextMenu(nodeElement(container, 'c'));

    expect(onNodeDoubleClick.mock.calls[0]![0].id).toBe('b');
    expect(onNodeContextMenu.mock.calls[0]![0].node.id).toBe('c');
    expect(contextMenu).toBe(false); // default prevented
  });

  it('exposes tree/treeitem semantics with levels', () => {
    const { container } = setup();
    expect(viewport(container).getAttribute('role')).toBe('tree');
    expect(viewport(container).getAttribute('aria-label')).toBe('Demo tree');
    expect(nodeElement(container, 'a').getAttribute('role')).toBe('treeitem');
    expect(nodeElement(container, 'a').getAttribute('aria-level')).toBe('1');
    expect(nodeElement(container, 'c').getAttribute('aria-expanded')).toBeNull();

    fireEvent.click(nodeElement(container, 'a').querySelector('.tk-toggle')!);
    expect(nodeElement(container, 'a1').getAttribute('aria-level')).toBe('2');
  });

  it('navigates with arrow keys via aria-activedescendant', () => {
    const { container, virtualizer } = setup();
    pressKey(container, 'ArrowDown');
    expect(viewport(container).getAttribute('aria-activedescendant')).toBe('tk-node-b');
    pressKey(container, 'End');
    expect(viewport(container).getAttribute('aria-activedescendant')).toBe('tk-node-c');
    expect(virtualizer.scrolledTo).toContain(2);
  });

  it('completes a keyboard grab-move-drop emitting a DropEvent', () => {
    const drops: DropEvent<string>[] = [];
    const { container } = setup({ onDrop: drop => drops.push(drop) });

    pressKey(container, 'End');
    pressKey(container, ' ');
    pressKey(container, 'ArrowUp');
    pressKey(container, ' ');

    expect(drops).toHaveLength(1);
    expect(drops[0]!.node?.id).toBe('c');
    expect(drops[0]!.target).toEqual(expect.objectContaining({ mode: 'into' }));
    expect(drops[0]!.target?.node.id).toBe('b');
  });

  it('never mutates the tree on drop', () => {
    const { container, state } = setup({ onDrop: () => undefined });
    const before = state.toHierarchy();

    pressKey(container, 'End');
    pressKey(container, ' ');
    pressKey(container, 'ArrowUp');
    pressKey(container, ' ');

    expect(state.toHierarchy()).toEqual(before);
  });

  it('announces keyboard DnD steps in the live region', () => {
    const { container } = setup();
    pressKey(container, 'End');
    pressKey(container, ' ');
    expect(container.querySelector('.tk-live-region')!.textContent).toContain('Gamma');
  });

  it('marks rows draggable unless readonly', () => {
    const { container, rerenderWith } = setup();
    expect(nodeElement(container, 'c').getAttribute('draggable')).toBe('true');

    rerenderWith({ isReadonly: true });
    expect(nodeElement(container, 'c').getAttribute('draggable')).toBe('false');
  });

  it('highlights the selected row', () => {
    const { container, rerenderWith } = setup();
    rerenderWith({ selectedId: 'b' });

    expect(nodeElement(container, 'b').classList.contains('selected')).toBe(true);
    expect(nodeElement(container, 'b').getAttribute('aria-selected')).toBe('true');
  });

  it('exposes the indent width as a custom property on the host', () => {
    const { container } = setup({ indentWidth: 24 });
    const host = container.querySelector<HTMLElement>('.tk-tree')!;

    expect(host.style.getPropertyValue('--tk-indent-width')).toBe('24px');
    expect(nodeElement(container, 'a').style.paddingLeft).toBe('0px');
  });
});

describe('TkTree engine lifecycle', () => {
  it('does not re-attach the engines when callback props change identity', () => {
    const { virtualizer, rerenderWith } = setup({ onNodeClick: () => undefined });
    expect(virtualizer.attachCount).toBe(1);

    rerenderWith({ onNodeClick: () => undefined, onDrop: () => undefined });
    rerenderWith({ onNodeClick: () => undefined, rowHeight: 40, indentWidth: 22 });

    expect(virtualizer.attachCount).toBe(1);
    expect(virtualizer.detachCount).toBe(0);
  });

  it('calls the latest callback after a re-render', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { container, rerenderWith } = setup({ onNodeClick: first });

    rerenderWith({ onNodeClick: second });
    fireEvent.click(nodeElement(container, 'c'));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('keeps keyboard focus state across option changes', () => {
    const { container, rerenderWith } = setup();
    pressKey(container, 'End');

    rerenderWith({ indentWidth: 30, springLoadDelay: 500 });

    expect(viewport(container).getAttribute('aria-activedescendant')).toBe('tk-node-c');
  });

  it('re-attaches when the state instance changes', () => {
    const { virtualizer, container, rerenderWith } = setup();
    const next = new TreeState<string>();
    next.setSource([{ id: 'z', name: 'Zeta', item: 'Z' }]);

    rerenderWith({ state: next });

    expect(virtualizer.attachCount).toBe(2);
    expect(virtualizer.detachCount).toBe(1);
    expect(rowTexts(container)).toEqual(['Zeta']);
  });

  it('attaches cleanly under StrictMode double mounting', () => {
    const state = createState();
    const virtualizer = new StubVirtualizer();
    const { container, unmount } = render(
      <StrictMode>
        <TkTree state={state} virtualizer={virtualizer} />
      </StrictMode>
    );

    // Every attach but the live one has been torn down.
    expect(virtualizer.attachCount - virtualizer.detachCount).toBe(1);
    expect(rowTexts(container)).toEqual(['Alpha', 'Beta', 'Gamma']);

    unmount();
    expect(virtualizer.attachCount).toBe(virtualizer.detachCount);
  });

  it('releases its state subscription on unmount, including under StrictMode', () => {
    const state = createState();
    const subscribe = state.subscribe.bind(state);
    let live = 0;
    state.subscribe = listener => {
      live++;
      const unsubscribe = subscribe(listener);
      return () => {
        live--;
        unsubscribe();
      };
    };

    const { unmount } = render(
      <StrictMode>
        <TkTree state={state} virtualizer={new StubVirtualizer()} />
      </StrictMode>
    );
    expect(live).toBe(1);

    unmount();
    expect(live).toBe(0);
  });
});

describe('TkTree multi-select', () => {
  function clickNode(container: HTMLElement, id: string, init: MouseEventInit = {}): void {
    fireEvent.click(nodeElement(container, id), init);
  }

  it('marks the tree as multi-selectable only when enabled', () => {
    const { container, rerenderWith } = setup({ multiSelect: true });
    expect(viewport(container).getAttribute('aria-multiselectable')).toBe('true');

    rerenderWith({ multiSelect: false });
    expect(viewport(container).getAttribute('aria-multiselectable')).toBeNull();
  });

  it('replaces the selection on a plain click', () => {
    const { container } = setup({ multiSelect: true });
    clickNode(container, 'a');
    clickNode(container, 'c');

    expect(selectedRowIds(container)).toEqual(['c']);
  });

  it('adds a row on ctrl-click and emits the new id set', () => {
    const onSelectedIdsChange = vi.fn<(ids: readonly string[]) => void>();
    const onSelectionChange = vi.fn<(nodes: readonly TreeNode<string>[]) => void>();
    const { container } = setup({ multiSelect: true, onSelectedIdsChange, onSelectionChange });
    clickNode(container, 'a');
    clickNode(container, 'c', { ctrlKey: true });

    expect(selectedRowIds(container)).toEqual(['a', 'c']);
    expect(onSelectedIdsChange.mock.calls.at(-1)![0]).toEqual(['a', 'c']);
    expect(onSelectionChange.mock.calls.at(-1)![0].map(node => node.id)).toEqual(['a', 'c']);
  });

  it('treats meta-click the same as ctrl-click', () => {
    const { container } = setup({ multiSelect: true });
    clickNode(container, 'a');
    clickNode(container, 'c', { metaKey: true });

    expect(selectedRowIds(container)).toEqual(['a', 'c']);
  });

  it('selects a range on shift-click', () => {
    const { container } = setup({ multiSelect: true });
    clickNode(container, 'a');
    clickNode(container, 'c', { shiftKey: true });

    expect(selectedRowIds(container)).toEqual(['a', 'b', 'c']);
  });

  it('reflects the selection in aria-selected', () => {
    const { container } = setup({ multiSelect: true });
    clickNode(container, 'b');

    expect(nodeElement(container, 'b').getAttribute('aria-selected')).toBe('true');
    expect(nodeElement(container, 'a').getAttribute('aria-selected')).toBe('false');
  });

  it('accepts a controlled selectedIds prop', () => {
    const { container, rerenderWith } = setup({ multiSelect: true });
    rerenderWith({ selectedIds: ['a', 'c'] });

    expect(selectedRowIds(container)).toEqual(['a', 'c']);
  });

  it('round-trips a controlled selection without looping', () => {
    const state = createState();
    const virtualizer = new StubVirtualizer();
    let renders = 0;

    function Host() {
      const [ids, setIds] = useState<readonly string[]>(['a']);
      renders++;
      return (
        <TkTree
          state={state}
          virtualizer={virtualizer}
          multiSelect
          selectedIds={ids}
          onSelectedIdsChange={setIds}
        />
      );
    }

    const { container } = render(<Host />);
    expect(selectedRowIds(container)).toEqual(['a']);

    fireEvent.click(nodeElement(container, 'c'), { ctrlKey: true });

    expect(selectedRowIds(container)).toEqual(['a', 'c']);
    expect(renders).toBeLessThan(10);
  });

  it('does not move the highlight on click when multi-select is off', () => {
    const { container } = setup({ multiSelect: false, selectedIds: ['b'] });
    expect(selectedRowIds(container)).toEqual(['b']);

    clickNode(container, 'a');

    // Fully controlled: the consumer owns the highlight.
    expect(selectedRowIds(container)).toEqual(['b']);
  });
});

describe('TkTree placeholders and imperative API', () => {
  const placeholders: Partial<TkTreeProps<string>> = {
    renderEmpty: () => <p className="empty-slot">Nothing here yet</p>,
    renderLoading: () => <p className="loading-slot">Loading…</p>,
  };

  it('shows no placeholder while rows exist', () => {
    const { container } = setup(placeholders);
    expect(container.querySelector('.empty-slot')).toBeNull();
    expect(container.querySelector('.loading-slot')).toBeNull();
  });

  it('shows the empty placeholder once nothing is visible', () => {
    const { container, state } = setup(placeholders);
    act(() => state.setFilter(() => false));

    expect(container.querySelector('.empty-slot')).not.toBeNull();
    expect(container.querySelectorAll('.tk-node')).toHaveLength(0);
  });

  it('gives the loading placeholder precedence over the empty one', () => {
    const { container, state, rerenderWith } = setup(placeholders);
    act(() => state.setFilter(() => false));
    rerenderWith({ isLoading: true });

    expect(container.querySelector('.loading-slot')).not.toBeNull();
    expect(container.querySelector('.empty-slot')).toBeNull();
  });

  it('emits onExpand and onCollapse from the toggle button', () => {
    const expanded: string[] = [];
    const collapsed: string[] = [];
    const { container } = setup({
      onExpand: node => expanded.push(node.id),
      onCollapse: node => collapsed.push(node.id),
    });
    const toggle = () => nodeElement(container, 'a').querySelector('.tk-toggle')!;

    fireEvent.click(toggle());
    expect(expanded).toEqual(['a']);

    fireEvent.click(toggle());
    expect(collapsed).toEqual(['a']);
  });

  it('does not emit onExpand for programmatic expansion', () => {
    const onExpand = vi.fn();
    const { state } = setup({ onExpand });
    act(() => state.expandAll());

    expect(onExpand).not.toHaveBeenCalled();
  });

  it('expands and collapses everything through the imperative handle', () => {
    const { container, ref } = setup();

    act(() => ref.current!.expandAll());
    expect(container.querySelectorAll('.tk-node')).toHaveLength(4);

    act(() => ref.current!.collapseAll());
    expect(container.querySelectorAll('.tk-node')).toHaveLength(3);
  });

  it('scrolls to a visible node and reports a hidden one as not found', () => {
    const { ref, virtualizer } = setup();

    expect(ref.current!.scrollToNode('c')).toBe(true);
    expect(virtualizer.scrolledTo.at(-1)).toBe(2);

    // `a1` is inside a collapsed folder, so there is no row to scroll to.
    expect(ref.current!.scrollToNode('a1')).toBe(false);
  });

  it('adds the indent-guide class only when enabled', () => {
    const { container, rerenderWith } = setup();
    expect(container.querySelector('.tk-node.tk-guides')).toBeNull();

    rerenderWith({ indentGuides: true });
    expect(container.querySelector('.tk-node.tk-guides')).not.toBeNull();
  });
});
