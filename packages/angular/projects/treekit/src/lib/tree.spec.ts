import { Component, signal } from '@angular/core';
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

  it('highlights the selected row', () => {
    host.selectedId.set('b');
    fixture.detectChanges();
    expect(nodeElement('b').classList.contains('selected')).toBe(true);
    expect(nodeElement('b').getAttribute('aria-selected')).toBe('true');
  });
});
