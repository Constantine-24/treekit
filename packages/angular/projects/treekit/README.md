# @treekit/angular

`<tk-tree>` — a virtualized Angular tree with native HTML5 drag-and-drop, keyboard-accessible
DnD, filtering, and lazy loading, built on the headless
[`@treekit/core`](https://www.npmjs.com/package/@treekit/core). No Material or CDK dependency.

```ts
import { TkTree, TkTreeNodeDef } from '@treekit/angular';
import { TreeState } from '@treekit/core';

@Component({
  imports: [TkTree, TkTreeNodeDef],
  template: `
    <tk-tree [state]="state" [rowHeight]="28" (dropElement)="onDrop($event)">
      <ng-template tkTreeNodeDef let-node>{{ node.name }}</ng-template>
    </tk-tree>
  `,
})
export class Explorer {
  state = new TreeState<MyItem>();

  onDrop(drop: DropEvent<MyItem>): void {
    if (drop.node && drop.target) {
      this.state.move(drop.node, drop.target);
    }
  }
}
```

- The consumer owns the `TreeState` — filtering, lazy loading, and mutations are core API calls.
- Theme via `--tk-*` CSS custom properties.
- Variable row heights: pass a `TanStackVirtualizer` (from `@treekit/core/tanstack`) to the
  `virtualizer` input.
- Full documentation, demos, and the limitations list live in the
  [repository README](https://github.com/kpenzin/treekit#readme).

MIT © Konstantin Penzin
