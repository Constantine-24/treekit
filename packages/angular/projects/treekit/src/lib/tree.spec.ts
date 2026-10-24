import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  DropEvent,
  TreeInput,
  TreeNode,
  TreeState,
  TreeVirtualizer,
  VirtualItem,
} from '@treekit/core';

import { TkTree } from './tree';
import { TkTreeNodeDef } from './tree-node-def';
import { TkTreeEmptyDef, TkTreeLoadingDef } from './tree-placeholders';

const ROW_HEIGHT = 30;

/** Renders every row — jsdom has no layout, so real virtualization is stubbed. */
class StubVirtualizer implements TreeVirtualizer {
  scrolledTo: number[] = [];
  private _count = 0;
  private _onChange: (() => void) | null = null;

  attach(_viewport: HTMLElement, onChange: () => void): () => void {
    this._onChange = onChange;
    return () => {
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

@Component({
  template: `
    <tk-tree
      [state]="state"
      [virtualizer]="virtualizer"
      [isReadonly]="isReadonly()"
      [selectedId]="selectedId()"
      ariaLabel="Demo tree"
      (dropped)="drops.push($event)"
      (nodeClick)="clicks.push($event)"
    >
      @if (useCustomTemplate()) {
        <ng-template tkTreeNodeDef let-node let-rowIndex="index">
          <span class="custom-cell">{{ rowIndex }}:{{ node.name.toUpperCase() }}</span>
        </ng-template>
      }
    </tk-tree>
  `,
  imports: [TkTree, TkTreeNodeDef],
})
class HostComponent {
  state = new TreeState<string>();
  virtualizer = new StubVirtualizer();
  isReadonly = signal(false);
  selectedId = signal<string | null>(null);
  useCustomTemplate = signal(false);
  drops: DropEvent<string>[] = [];
  clicks: TreeNode<string>[] = [];

  constructor() {
    this.state.setSource(fixtureSource());
  }
}

/** Stub that measures, exercising the variable-height path. */
class MeasuringStubVirtualizer extends StubVirtualizer {
  readonly measured: { index: number; className: string }[] = [];

  measure(element: HTMLElement, index: number): void {
    this.measured.push({ index, className: element.className });
  }
}

@Component({
  template: `<tk-tree [state]="state" [virtualizer]="virtualizer" />`,
  imports: [TkTree],
})
class MeasuringHostComponent {
  state = new TreeState<string>();
  virtualizer = new MeasuringStubVirtualizer();

  constructor() {
    this.state.setSource(fixtureSource());
  }
}

describe('TkTree', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rowTexts(): string[] {
    return Array.from(root().querySelectorAll<HTMLElement>('.tk-node')).map((node) =>
      node.textContent!.trim(),
    );
  }

  function viewport(): HTMLElement {
    return root().querySelector('.tk-viewport')!;
  }

  function nodeElement(id: string): HTMLElement {
    return root().querySelector(`[data-node-id="${id}"]`)!;
  }

  function pressKey(key: string): void {
    viewport().dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  /**
   * Guards the whole "engines attach, but the view never refreshes" failure
   * class: every other spec calls `detectChanges()` before asserting, so they
   * pass whether or not attaching actually notifies the scheduler. This one
   * renders on scheduling alone.
   */
  it('renders rows on first paint without a manual change-detection pass', async () => {
    const fresh = TestBed.createComponent(HostComponent);
    await fresh.whenStable();

    const element = fresh.nativeElement as HTMLElement;
    const rows = Array.from(element.querySelectorAll<HTMLElement>('.tk-node')).map((node) =>
      node.textContent!.trim(),
    );

    expect(rows).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(element.querySelector<HTMLElement>('.tk-content')!.style.height).toBe(
      `${3 * ROW_HEIGHT}px`,
    );
  });

  it('pins row height when the virtualizer does not measure', () => {
    const row = root().querySelector<HTMLElement>('.tk-row')!;

    expect(row.style.height).toBe(`${ROW_HEIGHT}px`);
    expect(row.style.minHeight).toBe('');
  });

  it('reports rendered rows to a measuring virtualizer and leaves their height free', async () => {
    const measuring = TestBed.createComponent(MeasuringHostComponent);
    await measuring.whenStable();

    const { measured } = measuring.componentInstance.virtualizer;
    expect(measured.map((entry) => entry.index)).toEqual([0, 1, 2]);
    expect(measured.every((entry) => entry.className.includes('tk-row'))).toBe(true);

    // A measured row must not carry a pinned height, or the estimate would be
    // fed straight back as the measurement.
    const row = (measuring.nativeElement as HTMLElement).querySelector<HTMLElement>('.tk-row')!;
    expect(row.style.height).toBe('');
    expect(row.style.minHeight).toBe(`${ROW_HEIGHT}px`);
  });

  it('renders the visible rows with default name templates', () => {
    expect(rowTexts()).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('renders projected templates with node and index context', () => {
    host.useCustomTemplate.set(true);
    fixture.detectChanges();
    const cells = Array.from(root().querySelectorAll<HTMLElement>('.custom-cell')).map(
      (cell) => cell.textContent,
    );
    expect(cells).toEqual(['0:ALPHA', '1:BETA', '2:GAMMA']);
  });

  it('expands a folder from its toggle button and reflects state changes', () => {
    nodeElement('a').querySelector<HTMLButtonElement>('.tk-toggle')!.click();
    fixture.detectChanges();
    expect(rowTexts()).toEqual(['Alpha', 'Alpha One', 'Beta', 'Gamma']);
    expect(nodeElement('a').getAttribute('aria-expanded')).toBe('true');
  });

  it('emits nodeClick and moves the active descendant to the clicked row', () => {
    nodeElement('c').click();
    fixture.detectChanges();
    expect(host.clicks.map((node) => node.id)).toEqual(['c']);
    expect(viewport().getAttribute('aria-activedescendant')).toBe('tk-node-c');
  });

  it('exposes tree/treeitem semantics with levels', () => {
    expect(viewport().getAttribute('role')).toBe('tree');
    expect(viewport().getAttribute('aria-label')).toBe('Demo tree');
    expect(nodeElement('a').getAttribute('role')).toBe('treeitem');
    expect(nodeElement('a').getAttribute('aria-level')).toBe('1');
    nodeElement('a').querySelector<HTMLButtonElement>('.tk-toggle')!.click();
    fixture.detectChanges();
    expect(nodeElement('a1').getAttribute('aria-level')).toBe('2');
  });

  it('navigates with arrow keys via aria-activedescendant', () => {
    pressKey('ArrowDown');
    expect(viewport().getAttribute('aria-activedescendant')).toBe('tk-node-b');
    pressKey('End');
    expect(viewport().getAttribute('aria-activedescendant')).toBe('tk-node-c');
    expect(host.virtualizer.scrolledTo).toContain(2);
  });

  it('completes a keyboard grab-move-drop emitting a DropEvent', () => {
    pressKey('End');
    pressKey(' ');
    pressKey('ArrowUp');
    pressKey(' ');

    expect(host.drops).toHaveLength(1);
    expect(host.drops[0]!.node?.id).toBe('c');
    expect(host.drops[0]!.target).toEqual(expect.objectContaining({ mode: 'into' }));
    expect(host.drops[0]!.target?.node.id).toBe('b');
  });

  it('never mutates the tree on drop', () => {
    const before = host.state.toHierarchy();

    pressKey('End');
    pressKey(' ');
    pressKey('ArrowUp');
    pressKey(' ');

    expect(host.drops).toHaveLength(1);
    expect(host.state.toHierarchy()).toEqual(before);
  });

  it('announces keyboard DnD steps in the live region', () => {
    pressKey('End');
    pressKey(' ');
    const liveRegion = fixture.nativeElement.querySelector('.tk-live-region')!;
    expect(liveRegion.textContent).toContain('Gamma');
  });

  it('marks rows draggable unless readonly', () => {
    expect(nodeElement('c').getAttribute('draggable')).toBe('true');
    host.isReadonly.set(true);
    fixture.detectChanges();
    expect(nodeElement('c').getAttribute('draggable')).toBe('false');
  });

  it('exposes the indent width as a custom property on the host', () => {
    const tree = root().querySelector<HTMLElement>('tk-tree')!;
    expect(tree.style.getPropertyValue('--tk-indent-width')).toBe('18px');

    nodeElement('a').querySelector<HTMLButtonElement>('.tk-toggle')!.click();
    fixture.detectChanges();

    expect(nodeElement('a').style.paddingLeft).toBe('0px');
    expect(nodeElement('a1').style.paddingLeft).toBe('18px');
  });

  it('highlights the selected row', () => {
    host.selectedId.set('b');
    fixture.detectChanges();
    expect(nodeElement('b').classList.contains('selected')).toBe(true);
    expect(nodeElement('b').getAttribute('aria-selected')).toBe('true');
  });
});

@Component({
  template: `
    <tk-tree
      [state]="state"
      [virtualizer]="virtualizer"
      [multiSelect]="multiSelect()"
      [selectedIds]="selectedIds()"
      (selectedIdsChange)="emitted.push($event)"
    />
  `,
  imports: [TkTree],
})
class MultiSelectHostComponent {
  state = new TreeState<string>();
  virtualizer = new StubVirtualizer();
  multiSelect = signal(true);
  selectedIds = signal<readonly string[] | null>(null);
  emitted: (readonly string[])[] = [];

  constructor() {
    this.state.setSource(fixtureSource());
  }
}

describe('TkTree multi-select', () => {
  let fixture: ComponentFixture<MultiSelectHostComponent>;
  let host: MultiSelectHostComponent;

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** `HTMLElement.click()` cannot carry modifiers, so dispatch explicitly. */
  function clickNode(id: string, init: MouseEventInit = {}): void {
    element()
      .querySelector<HTMLElement>(`[data-node-id="${id}"]`)!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, ...init }));
    fixture.detectChanges();
  }

  function selectedIds(): string[] {
    return Array.from(element().querySelectorAll<HTMLElement>('.tk-node.selected')).map((node) =>
      node.getAttribute('data-node-id')!,
    );
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MultiSelectHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(MultiSelectHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('marks the tree as multi-selectable only when enabled', () => {
    expect(element().querySelector('.tk-viewport')!.getAttribute('aria-multiselectable')).toBe(
      'true',
    );

    host.multiSelect.set(false);
    fixture.detectChanges();

    expect(
      element().querySelector('.tk-viewport')!.getAttribute('aria-multiselectable'),
    ).toBeNull();
  });

  it('replaces the selection on a plain click', () => {
    clickNode('a');
    clickNode('c');

    expect(selectedIds()).toEqual(['c']);
  });

  it('adds a row on ctrl-click and emits the new id set', () => {
    clickNode('a');
    clickNode('c', { ctrlKey: true });

    expect(selectedIds()).toEqual(['a', 'c']);
    expect(host.emitted.at(-1)).toEqual(['a', 'c']);
  });

  it('treats meta-click the same as ctrl-click', () => {
    clickNode('a');
    clickNode('c', { metaKey: true });

    expect(selectedIds()).toEqual(['a', 'c']);
  });

  it('selects a range on shift-click', () => {
    clickNode('a');
    clickNode('c', { shiftKey: true });

    expect(selectedIds()).toEqual(['a', 'b', 'c']);
  });

  it('reflects the selection in aria-selected', () => {
    clickNode('b');

    expect(
      element().querySelector<HTMLElement>('[data-node-id="b"]')!.getAttribute('aria-selected'),
    ).toBe('true');
    expect(
      element().querySelector<HTMLElement>('[data-node-id="a"]')!.getAttribute('aria-selected'),
    ).toBe('false');
  });

  it('accepts a controlled selectedIds binding', () => {
    host.selectedIds.set(['a', 'c']);
    fixture.detectChanges();

    expect(selectedIds()).toEqual(['a', 'c']);
  });

  it('does not move the highlight on click when multi-select is off', () => {
    host.multiSelect.set(false);
    host.selectedIds.set(['b']);
    fixture.detectChanges();
    expect(selectedIds()).toEqual(['b']);

    clickNode('a');

    // Fully controlled: the consumer owns the highlight.
    expect(selectedIds()).toEqual(['b']);
  });
});

@Component({
  template: `
    <tk-tree
      [state]="state"
      [virtualizer]="virtualizer"
      [isLoading]="isLoading()"
      [indentGuides]="indentGuides()"
      (expanded)="expandedIds.push($event.id)"
      (collapsed)="collapsedIds.push($event.id)"
    >
      <ng-template tkTreeEmpty><p class="empty-slot">Nothing here yet</p></ng-template>
      <ng-template tkTreeLoading><p class="loading-slot">Loading…</p></ng-template>
    </tk-tree>
  `,
  imports: [TkTree, TkTreeEmptyDef, TkTreeLoadingDef],
})
class PlaceholderHostComponent {
  readonly tree = viewChild.required(TkTree);
  state = new TreeState<string>();
  virtualizer = new StubVirtualizer();
  isLoading = signal(false);
  indentGuides = signal(false);
  expandedIds: string[] = [];
  collapsedIds: string[] = [];

  constructor() {
    this.state.setSource(fixtureSource());
  }
}

describe('TkTree placeholders and imperative API', () => {
  let fixture: ComponentFixture<PlaceholderHostComponent>;
  let host: PlaceholderHostComponent;

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaceholderHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(PlaceholderHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows no placeholder while rows exist', () => {
    expect(element().querySelector('.empty-slot')).toBeNull();
    expect(element().querySelector('.loading-slot')).toBeNull();
  });

  it('shows the empty template once nothing is visible', () => {
    host.state.setFilter(() => false);
    fixture.detectChanges();

    expect(element().querySelector('.empty-slot')).not.toBeNull();
    expect(element().querySelectorAll('.tk-node')).toHaveLength(0);
  });

  it('gives the loading template precedence over the empty one', () => {
    host.state.setFilter(() => false);
    host.isLoading.set(true);
    fixture.detectChanges();

    expect(element().querySelector('.loading-slot')).not.toBeNull();
    expect(element().querySelector('.empty-slot')).toBeNull();
  });

  it('emits expanded and collapsed from the toggle button', () => {
    const toggle = element().querySelector<HTMLButtonElement>('[data-node-id="a"] .tk-toggle')!;

    toggle.click();
    fixture.detectChanges();
    expect(host.expandedIds).toEqual(['a']);

    toggle.click();
    fixture.detectChanges();
    expect(host.collapsedIds).toEqual(['a']);
  });

  it('does not emit expanded for programmatic expansion', () => {
    host.state.expandAll();
    fixture.detectChanges();

    expect(host.expandedIds).toEqual([]);
  });

  it('expands and collapses everything through the imperative API', () => {
    host.tree().expandAll();
    fixture.detectChanges();
    expect(element().querySelectorAll('.tk-node')).toHaveLength(4);

    host.tree().collapseAll();
    fixture.detectChanges();
    expect(element().querySelectorAll('.tk-node')).toHaveLength(3);
  });

  it('scrolls to a visible node and reports a hidden one as not found', () => {
    expect(host.tree().scrollToNode('c')).toBe(true);
    expect(host.virtualizer.scrolledTo.at(-1)).toBe(2);

    // `a1` is inside a collapsed folder, so there is no row to scroll to.
    expect(host.tree().scrollToNode('a1')).toBe(false);
  });

  it('adds the indent-guide class only when enabled', () => {
    expect(element().querySelector('.tk-node.tk-guides')).toBeNull();

    host.indentGuides.set(true);
    fixture.detectChanges();

    expect(element().querySelector('.tk-node.tk-guides')).not.toBeNull();
  });
});
