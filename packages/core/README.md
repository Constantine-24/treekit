# @treekit/core

Headless, zero-dependency tree engine: virtualized rendering, native HTML5 drag-and-drop with
precise drop feedback, keyboard-accessible DnD, filtering, and lazy loading. Bring your own
rendering — or use [`@treekit/angular`](https://www.npmjs.com/package/@treekit/angular).

```ts
import { DndEngine, FixedHeightVirtualizer, KeyboardController, TreeState } from '@treekit/core';

const state = new TreeState<MyItem>();
state.setSource([
  {
    id: 'plant',
    name: 'Plant',
    item: plant,
    isFolder: true,
    children: [/* … */],
  },
]);

const virtualizer = new FixedHeightVirtualizer({ rowHeight: 28 });
const engine = new DndEngine<MyItem>({
  getVisibleNodes: () => state.visibleNodes(),
  onDrop: drop => drop.target && state.moveMany([...drop.nodes], drop.target),
  canDropAt: (nodes, target) => state.canMoveMany(nodes, target),
});

state.subscribe(render);
virtualizer.attach(viewportElement, render);
engine.attach(viewportElement, contentElement);
```

- Rows render wherever you like — the engine only needs `data-node-id` attributes on row
  elements and absolute positioning driven by `virtualizer.items()`.
- Variable row heights: install `@tanstack/virtual-core` and use `TanStackVirtualizer` from
  `@treekit/core/tanstack`.
- Full documentation, demos, and the honest limitations list live in the
  [repository README](https://github.com/kpenzin/treekit#readme).

MIT © Konstantin Penzin
