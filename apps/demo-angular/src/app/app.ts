import { Component, computed, signal } from '@angular/core';
import { DropEvent, TreeNode } from '@constantine-24/treekit-core';
import {
  applyDrop,
  createDemoState,
  createVirtualizer,
  DEMO_LINKS,
  DemoItem,
  DropProbe,
  FeatureToggleKey,
  GaugeKey,
  generateForest,
  initialToggles,
  nameFilter,
} from 'demo-shared';

import { Calipers } from './calipers/calipers';
import { Gauges } from './gauges/gauges';
import { KeyLegend } from './key-legend/key-legend';
import { Palette } from './palette/palette';
import { StatusBar } from './status-bar/status-bar';
import { ThemeToggle } from './theme-toggle/theme-toggle';
import { Toolbar } from './toolbar/toolbar';
import { TreePanel } from './tree-panel/tree-panel';

/** The page shell. Owns the tree state; every panel is a component under `src/app/`. */
@Component({
  selector: 'app-root',
  host: { class: 'demo' },
  imports: [Calipers, Gauges, KeyLegend, Palette, StatusBar, ThemeToggle, Toolbar, TreePanel],
  template: `
    <header class="masthead">
      <div class="mark">
        <h1 class="wordmark"><a href="../">treekit</a></h1>
        <span class="rule-h"></span>
        <span class="label">Angular · headless · virtualized · native HTML5 drag</span>
      </div>
      <nav aria-label="treekit">
        <a class="ghost" href="../react/">React demo</a>
        <a class="ghost" [href]="links.github">GitHub</a>
      </nav>
      <app-theme-toggle />
    </header>

    <main class="deck">
      <aside class="rail" aria-label="Controls and counters">
        <app-gauges [counts]="counts()" />
        <app-palette (dragEnded)="probe.set(null)" />
        <app-key-legend />
      </aside>

      <section class="instrument" aria-label="Tree">
        <app-toolbar
          [toggles]="toggles()"
          (filterChange)="onFilter($event)"
          (toggleChange)="onToggle($event.key, $event.value)"
          (expandAll)="panel.expandAll()"
          (collapseAll)="panel.collapseAll()"
        />
        <app-tree-panel
          #panel
          [state]="state"
          [virtualizer]="virtualizer()"
          [toggles]="toggles()"
          (dropped)="onDrop($event)"
          (nodeClick)="onNodeClick($event)"
          (selectionCountChange)="selectedCount.set($event)"
          (renderedCountChange)="renderedCount.set($event)"
          (probeChange)="probe.set($event)"
        />
        <app-status-bar [probe]="probe()" [status]="status()" />
      </section>
    </main>

    @if (probe(); as reading) {
      <app-calipers [probe]="reading" />
    }
  `,
})
export class App {
  readonly state = createDemoState();

  protected readonly links = DEMO_LINKS;
  protected readonly toggles = signal(initialToggles());
  protected readonly status = signal('');
  protected readonly probe = signal<DropProbe | null>(null);
  protected readonly selectedCount = signal(0);
  protected readonly renderedCount = signal(0);

  /** Bumped by every tree mutation so the counters re-derive from the plain state object. */
  private readonly _version = signal(0);
  private _addedCounter = 0;

  /**
   * Narrowed to the one toggle the virtualizer depends on: a new virtualizer
   * re-attaches the tree (resetting selection and focus), so flipping "Guides"
   * or "Read only" must not create one.
   */
  private readonly _measuredRows = computed(() => this.toggles().measuredRows);
  protected readonly virtualizer = computed(() => createVirtualizer(this._measuredRows()));

  protected readonly counts = computed<Record<GaugeKey, number>>(() => {
    this._version();
    return {
      total: this.state.nodes().length,
      visible: this.state.visibleNodes().length,
      rendered: this.renderedCount(),
      selected: this.selectedCount(),
    };
  });

  constructor() {
    this.state.setSource(generateForest());
    this.state.subscribe(() => this._version.update((version) => version + 1));
  }

  protected onFilter(query: string): void {
    this.state.setFilter(nameFilter(query));
  }

  protected onToggle(key: FeatureToggleKey, value: boolean): void {
    this.toggles.update((toggles) => ({ ...toggles, [key]: value }));
  }

  protected onDrop(drop: DropEvent<DemoItem>): void {
    this.probe.set(null);
    const status = applyDrop(this.state, drop, () => `added-${this._addedCounter++}`);
    if (status) {
      this.status.set(status);
    }
  }

  protected onNodeClick(node: TreeNode<DemoItem>): void {
    this.status.set(node.name);
  }
}
