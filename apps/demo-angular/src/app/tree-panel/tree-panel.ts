import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TkTree, TkTreeEmptyDef, TkTreeNodeDef } from '@constantine-24/treekit-angular';
import { DropEvent, TreeNode, TreeState, TreeVirtualizer } from '@constantine-24/treekit-core';
import {
  DemoItem,
  DropProbe,
  FeatureToggleKey,
  observeRenderedRows,
  probeDrop,
  ROW_HEIGHT,
  SPRING_LOAD_DELAY,
} from 'demo-shared';

/**
 * The tree itself, plus the drag probe that feeds the calipers and status bar.
 */
@Component({
  selector: 'app-tree-panel',
  host: {
    class: 'tree-panel',
    '(dragover)': 'onDragOver($event)',
    '(dragleave)': 'probeChange.emit(null)',
    '(drop)': 'probeChange.emit(null)',
  },
  imports: [TkTree, TkTreeNodeDef, TkTreeEmptyDef],
  template: `
    <tk-tree
      [state]="state()"
      [virtualizer]="virtualizer()"
      [rowHeight]="rowHeight"
      [isReadonly]="toggles().readOnly"
      [multiSelect]="true"
      [indentGuides]="toggles().indentGuides"
      [springLoadDelay]="springLoadDelay"
      ariaLabel="Sensor hierarchy"
      (dropped)="dropped.emit($event)"
      (nodeClick)="nodeClick.emit($event)"
      (selectionChange)="selectionCountChange.emit($event.length)"
    >
      <ng-template tkTreeNodeDef let-node>
        <span class="row-name">{{ node.name }}</span>
        @if (node.item.unit) {
          <span class="row-unit">{{ node.item.unit }}</span>
        }
      </ng-template>
      <ng-template tkTreeEmpty>
        <span class="label">No rows match that filter</span>
      </ng-template>
    </tk-tree>
  `,
})
export class TreePanel {
  readonly state = input.required<TreeState<DemoItem>>();
  readonly virtualizer = input.required<TreeVirtualizer>();
  readonly toggles = input.required<Record<FeatureToggleKey, boolean>>();

  /** Reported, not applied: the app decides what a drop does. */
  readonly dropped = output<DropEvent<DemoItem>>();
  readonly nodeClick = output<TreeNode<DemoItem>>();
  readonly selectionCountChange = output<number>();
  readonly renderedCountChange = output<number>();
  readonly probeChange = output<DropProbe | null>();

  protected readonly rowHeight = ROW_HEIGHT;
  protected readonly springLoadDelay = SPRING_LOAD_DELAY;

  private readonly _tree = viewChild.required(TkTree);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const stop = observeRenderedRows(host, (count) => this.renderedCountChange.emit(count));
      destroyRef.onDestroy(stop);
    });
  }

  /** Expands every loaded folder through the tree's imperative API. */
  expandAll(): void {
    this._tree().expandAll();
  }

  /** Collapses every folder through the tree's imperative API. */
  collapseAll(): void {
    this._tree().collapseAll();
  }

  protected onDragOver(event: DragEvent): void {
    this.probeChange.emit(probeDrop(this.state(), event.clientX, event.clientY));
  }
}
