import { Component, computed, signal } from '@angular/core';
import { TkTree, TkTreeNodeDef } from '@treekit/angular';
import {
  DropEvent,
  FixedHeightVirtualizer,
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

@Component({
  selector: 'app-root',
  imports: [TkTree, TkTreeNodeDef],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly paletteLabels = ['Temperature', 'Pressure', 'Vibration', 'Humidity', 'Voltage'];
  readonly paletteMime = PALETTE_MIME;

  readonly state = new TreeState<DemoItem>({
    onLoadChildren: (node) => this._loadLazyChildren(node),
  });

  readonly isReadonly = signal(false);
  readonly useTanStack = signal(false);
  readonly selectedId = signal<string | null>(null);
  readonly lastDrop = signal('');

  readonly virtualizer = computed<TreeVirtualizer>(() =>
    this.useTanStack()
      ? new TanStackVirtualizer({ estimateSize: () => ROW_HEIGHT, overscan: 6 })
      : new FixedHeightVirtualizer({ rowHeight: ROW_HEIGHT, overscan: 6 }),
  );

  readonly rowHeight = ROW_HEIGHT;

  private _addedCounter = 0;

  constructor() {
    this.state.setSource(generateForest());
  }

  onFilter(query: string): void {
    const normalized = query.trim().toLowerCase();
    this.state.setFilter(
      normalized ? (node) => node.name.toLowerCase().includes(normalized) : null,
    );
  }

  onDrop(drop: DropEvent<DemoItem>): void {
    if (!drop.target) {
      return;
    }
    if (drop.node) {
      if (this.state.move(drop.node, drop.target)) {
        this.lastDrop.set(`Moved ${drop.node.name} ${drop.target.mode} ${drop.target.node.name}`);
      }
      return;
    }
    const label = drop.dataTransfer?.getData(PALETTE_MIME);
    if (label) {
      this.state.add(
        {
          id: `added-${this._addedCounter++}`,
          name: label,
          item: { kind: 'sensor' },
        },
        drop.target,
      );
      this.lastDrop.set(`Added ${label} ${drop.target.mode} ${drop.target.node.name}`);
    }
  }

  onNodeClick(node: TreeNode<DemoItem>): void {
    this.selectedId.set(node.id);
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
