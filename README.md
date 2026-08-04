# treekit

Headless, virtualized tree with native HTML5 drag-and-drop. Framework-free core, thin Angular adapter.

Most tree widgets bolt drag-and-drop onto a flow-layout list, which falls apart once the list is
virtualized: placeholder elements shift absolutely-positioned rows, indices lie, and drop feedback
flickers. treekit takes the opposite approach — rows are positioned by a virtualizer, and drop
targets are resolved purely from the pointer position against the rendered rows. No placeholder ever
enters the layout; a single insertion line (or folder highlight) is drawn on top.

## Packages

| Package                                | Description                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| [`@treekit/core`](packages/core)       | Zero-dependency headless engine: tree state, virtualization, DnD, keyboard.  |
| [`@treekit/angular`](packages/angular) | Angular component (`<tk-tree>`) over the core. No Material / CDK dependency. |

## Features

- **Virtualized** — renders only visible rows; 10,000+ nodes stay smooth.
- **Native HTML5 drag-and-drop** — in-tree reorder, drop-into-folder, and external drag sources via
  plain `draggable` + `dataTransfer`. Cross-tree and cross-window drags work for free.
- **Precise drop feedback** — pointer-position hit-testing, `into`/`before`/`after` intent (folder
  middle 50% = into), explicit insertion line, edge auto-scroll during drag.
- **Multi-select and multi-node drag** — ctrl/cmd-click, shift-click ranges, `Ctrl/Cmd+A`, and a
  drag that carries the whole selection. Payloads are normalized: document order, de-duplicated,
  and de-nested so a folder never moves alongside its own descendants.
- **Keyboard-accessible DnD** — every pointer drag operation has a keyboard equivalent
  (grab → move → drop) emitting the same events; `role=tree` semantics and live-region announcements.
- **Filtering** — predicate-based; reveals matches plus their ancestors, auto-expanded; restores
  expansion state when cleared; drag stays enabled while filtered.
- **Lazy loading** — expandable nodes without children request them on first expand.
- **Headless** — the core has no framework, no RxJS, no DOM framework assumptions beyond the
  standard DOM APIs. Bring your own rendering, or use the Angular adapter.

## Quick start

Angular:

```ts
import { TkTree, TkTreeNodeDef } from '@treekit/angular';
import { TreeState } from '@treekit/core';

@Component({
  imports: [TkTree, TkTreeNodeDef],
  template: `
    <tk-tree [state]="state" [rowHeight]="28" (dropped)="onDrop($event)">
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

Any framework (or none) — the same engine against plain DOM:

```ts
import { DndEngine, FixedHeightVirtualizer, TreeState } from '@treekit/core';

const state = new TreeState<MyItem>();
state.setSource(myRoots);

const virtualizer = new FixedHeightVirtualizer({ rowHeight: 28 });
const engine = new DndEngine<MyItem>({
  getVisibleNodes: () => state.visibleNodes(),
  onDrop: drop => drop.target && state.moveMany([...drop.nodes], drop.target),
  canDropAt: (nodes, target) => state.canMoveMany(nodes, target),
});

state.subscribe(render);
virtualizer.attach(viewport, render);
engine.attach(viewport, content);
```

See the runnable demos. [`apps/demo-angular`](apps/demo-angular) is the showcase — 10k nodes,
multi-select, palette drag, filtering, a lazy branch, spring-loaded folders, and a virtualizer
toggle — and it reports the library's own drop arithmetic live: hover a row mid-drag and it draws
the 0.25 / 0.5 / 0.75 intent bands while printing the pointer fraction and the `resolveDropIntent`
call that produced the result. [`apps/demo-vanilla`](apps/demo-vanilla) is the headless proof, the
same engine against plain DOM in under 7 kB gzipped.

```sh
cd apps/demo-angular && pnpm start   # http://localhost:4200
```

## Rules & limitations (read before adopting)

- **Native HTML5 DnD does not fire from touch gestures on Android Chrome.** Desktop, mouse, and pen
  work everywhere; iOS Safari supports native DnD. The keyboard DnD mode is the supported fallback
  on touch devices.
- The built-in virtualizer assumes a **fixed row height** (configurable). Variable / measured row
  heights are supported through the optional `@treekit/core/tanstack` adapter, which requires
  installing `@tanstack/virtual-core`.
- The tree **owns its scroll viewport**. There is no window-scroll / scroll-margin mode.
- **Enabling multi-select changes one keybinding.** `Space` becomes "toggle selection" and
  `Ctrl/Cmd+Space` becomes "grab for keyboard drag". Without multi-select, `Space` still grabs.
  Every unambiguous alternative chord collides with a browser or OS shortcut.
- Selection is **explicit**: selecting a folder does not select its descendants. A move already
  relocates the whole subtree, so implying descendants would ask to move them twice over. Use the
  exported `denestNodes` if you need the same normalization for a bulk action of your own.
- RTL layouts are untested in v1.

## Development

```sh
corepack enable pnpm
pnpm install
pnpm build     # build all packages
pnpm test      # run all test suites
pnpm lint
```

Releases are versioned with [Changesets](https://github.com/changesets/changesets).

## License

MIT
