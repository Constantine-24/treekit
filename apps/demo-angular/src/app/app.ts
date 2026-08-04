import {
  afterRenderEffect,
  Component,
  computed,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TkTree, TkTreeEmptyDef, TkTreeNodeDef } from '@treekit/angular';
import {
  DropEvent,
  DropMode,
  FixedHeightVirtualizer,
  resolveDropIntent,
  TreeInput,
  TreeNode,
  TreeState,
  TreeVirtualizer,
} from '@treekit/core';
import { TanStackVirtualizer } from '@treekit/core/tanstack';

const PALETTE_MIME = 'application/x-treekit-label';
const ROW_HEIGHT = 28;

interface DemoItem {
  kind: 'group' | 'sensor';
  unit?: string;
}

/**
 * Live reading of the drop decision under the pointer.
 *
 * The demo resolves this itself from the pointer position and the row's
 * rectangle, then calls the library's own exported `resolveDropIntent` — so the
 * readout is the real decision function, not a description of it.
 */
interface DropProbe {
  name: string;
  isFolder: boolean;
  fraction: number;
  mode: DropMode;
  top: number;
  left: number;
  width: number;
  height: number;
}

function generateForest(): TreeInput<DemoItem>[] {
  const units = ['°C', 'bar', 'mm/s', '%', 'V'];
  const roots: TreeInput<DemoItem>[] = [];
  for (let group = 0; group < 100; group++) {
    roots.push({
      id: `group-${group}`,
      name: `Group ${String(group).padStart(3, '0')}`,
      item: { kind: 'group' },
      isFolder: true,
      children: Array.from({ length: 99 }, (_, leaf) => ({
        id: `leaf-${group}-${leaf}`,
        name: `Sensor ${String(group).padStart(3, '0')}.${String(leaf).padStart(2, '0')}`,
        item: { kind: 'sensor', unit: units[leaf % units.length] },
      })),
    });
  }
  roots.push({
    id: 'remote',
    name: 'Remote site (lazy)',
    item: { kind: 'group' },
    isFolder: true,
    expandable: true,
  });
  return roots;
}

function group(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

@Component({
  selector: 'app-root',
  imports: [TkTree, TkTreeEmptyDef, TkTreeNodeDef],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly paletteLabels = ['Temperature', 'Pressure', 'Vibration', 'Humidity', 'Voltage'];
  readonly paletteMime = PALETTE_MIME;
  readonly rowHeight = ROW_HEIGHT;

  readonly state = new TreeState<DemoItem>({
    onLoadChildren: (node) => this._loadLazyChildren(node),
  });

  private readonly _tree = viewChild(TkTree);

  readonly isReadonly = signal(false);
  readonly useTanStack = signal(false);
  readonly indentGuides = signal(true);
  readonly isDark = signal(false);
  readonly selectionCount = signal(0);
  readonly status = signal('');
  readonly probe = signal<DropProbe | null>(null);

  /** Bumped by every tree mutation so the readouts re-derive. */
  private readonly _version = signal(0);

  readonly virtualizer = computed<TreeVirtualizer>(() =>
    this.useTanStack()
      ? new TanStackVirtualizer({ estimateSize: () => ROW_HEIGHT, overscan: 6 })
      : new FixedHeightVirtualizer({ rowHeight: ROW_HEIGHT, overscan: 6 }),
  );

  readonly totalNodes = computed(() => {
    this._version();
    return group(this.state.nodes().length);
  });

  readonly visibleCount = computed(() => {
    this._version();
    return group(this.state.visibleNodes().length);
  });

  /**
   * Rows actually in the DOM — the number the whole library exists to keep
   * small.
   *
   * Read after render, not from a computed: `<tk-tree>`'s `state` is a required
   * input, and touching `rows()` during the same pass that creates the view
   * throws NG0950 before the input is bound.
   */
  readonly renderedCount = signal(0);

  private _addedCounter = 0;

  constructor() {
    this.state.setSource(generateForest());
    this.state.subscribe(() => this._version.update((version) => version + 1));

    afterRenderEffect(() => {
      const rendered = this._tree()?.rows().length ?? 0;
      untracked(() => this.renderedCount.set(rendered));
    });
  }

  // MARK: - Controls

  toggleTheme(): void {
    this.isDark.update((dark) => !dark);
    document.documentElement.setAttribute('data-theme', this.isDark() ? 'dark' : 'light');
  }

  onFilter(query: string): void {
    const normalized = query.trim().toLowerCase();
    this.state.setFilter(
      normalized ? (node) => node.name.toLowerCase().includes(normalized) : null,
    );
  }

  expandAll(): void {
    this._tree()?.expandAll();
  }

  collapseAll(): void {
    this._tree()?.collapseAll();
  }

  // MARK: - The drop-math readout

  /**
   * Recomputes the drop decision for the row under the pointer.
   *
   * Deliberately mirrors what `DndEngine` does internally — hit-test with
   * `elementFromPoint`, take the pointer's fraction within the row's rect, hand
   * both to `resolveDropIntent` — so the page shows the library's real
   * arithmetic rather than an illustration of it.
   */
  onProbe(event: DragEvent): void {
    const row = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest('[data-node-id]') as HTMLElement | null;
    const node = row && this.state.findById(row.getAttribute('data-node-id') ?? '');
    if (!row || !node) {
      this.probe.set(null);
      return;
    }
    const rect = row.getBoundingClientRect();
    const fraction = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0;
    const isFolder = !!node.isFolder;
    this.probe.set({
      name: node.name,
      isFolder,
      fraction,
      mode: resolveDropIntent(isFolder, fraction),
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  }

  clearProbe(): void {
    this.probe.set(null);
  }

  format(fraction: number): string {
    return fraction.toFixed(2);
  }

  // MARK: - Tree events

  onDrop(drop: DropEvent<DemoItem>): void {
    this.clearProbe();
    if (!drop.target) {
      return;
    }
    if (drop.nodes.length > 0) {
      if (this.state.moveMany([...drop.nodes], drop.target)) {
        const what = drop.nodes.length === 1 ? drop.nodes[0]!.name : `${drop.nodes.length} rows`;
        this.status.set(`Moved ${what} ${drop.target.mode} ${drop.target.node.name}`);
      }
      return;
    }
    const label = drop.dataTransfer?.getData(PALETTE_MIME);
    if (label) {
      this.state.add(
        { id: `added-${this._addedCounter++}`, name: label, item: { kind: 'sensor' } },
        drop.target,
      );
      this.status.set(`Added ${label} ${drop.target.mode} ${drop.target.node.name}`);
    }
  }

  onNodeClick(node: TreeNode<DemoItem>): void {
    this.status.set(node.name);
  }

  onPaletteDragStart(event: DragEvent, label: string): void {
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData(PALETTE_MIME, label);
      event.dataTransfer.setData('text/plain', label);
    }
  }

  private _loadLazyChildren(node: TreeNode<DemoItem>): void {
    setTimeout(() => {
      this.state.setChildren(
        node,
        Array.from({ length: 25 }, (_, index) => ({
          id: `remote-${index}`,
          name: `Remote sensor ${index}`,
          item: { kind: 'sensor', unit: 'kW' },
        })),
      );
    }, 800);
  }
}
