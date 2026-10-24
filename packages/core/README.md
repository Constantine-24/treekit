# @treekit/core

[![npm](https://img.shields.io/npm/v/@treekit/core?color=2f4fe0)](https://www.npmjs.com/package/@treekit/core)
[![CI](https://github.com/Constantine-24/treekit/actions/workflows/ci.yml/badge.svg)](https://github.com/Constantine-24/treekit/actions/workflows/ci.yml)
[![dependencies](https://img.shields.io/badge/dependencies-0-2f4fe0)](https://github.com/Constantine-24/treekit/blob/main/packages/core/package.json)
[![license](https://img.shields.io/npm/l/@treekit/core)](https://github.com/Constantine-24/treekit/blob/main/LICENSE)

The headless, zero-dependency engine behind [treekit](https://github.com/Constantine-24/treekit): a virtualized tree with native HTML5 drag-and-drop, keyboard-accessible drag-and-drop, multi-select, filtering and lazy loading. Use it through [`@treekit/react`](https://www.npmjs.com/package/@treekit/react) or [`@treekit/angular`](https://www.npmjs.com/package/@treekit/angular) — or attach it to plain DOM yourself.

**[Live demo](https://constantine-24.github.io/treekit/)**

<img src="https://raw.githubusercontent.com/Constantine-24/treekit/main/docs/images/demo.png" alt="A live treekit tree of 10,001 nodes with 18 rows in the DOM" width="720">

## Installation

```bash
npm install @treekit/core
# optional, only for measured (variable-height) rows:
npm install @tanstack/virtual-core
```

## The five layers

The layers are independent and separately attachable. They share no state — only `TreeNode` object identity and the `data-node-id` attribute on rendered rows — so you can use any of them alone.

The premise: **rows are absolutely positioned by a virtualizer**, so flow-based drag-and-drop (placeholder elements, index-based sorting) cannot work. Every drop decision is made from the pointer position against the rendered rows instead.

### `TreeState<T>` — data and structure

```ts
import { TreeState } from '@treekit/core';

const state = new TreeState<Sensor>({
  // Called when an `expandable` folder with no children is expanded.
  onLoadChildren: node => api.children(node.id).then(children => state.setChildren(node, children)),
});

state.setSource([
  { id: 'plant', name: 'Plant', item: plant, isFolder: true, children: [/* … */] },
  { id: 'remote', name: 'Remote site', item: site, isFolder: true, expandable: true },
]);

state.visibleNodes(); // the flat, depth-first list a virtualizer renders
state.subscribe(() => render()); // notified after every change
state.setFilter(node => node.name.includes('Pump')); // keeps ancestors; `null` clears
state.moveMany(nodes, { node: target, mode: 'into' }); // 'into' | 'before' | 'after'
```

Children arrays are the single source of order; node objects keep their identity across changes, while `nodes()` / `visibleNodes()` return a new array after each one. Filtering never touches `isExpanded`, so clearing a filter restores the previous view — use `isExpandedNow(node)` for what to render.

### `TreeVirtualizer` — which rows exist

```ts
import { FixedHeightVirtualizer } from '@treekit/core';
import { TanStackVirtualizer } from '@treekit/core/tanstack'; // needs @tanstack/virtual-core

const virtualizer = new FixedHeightVirtualizer({ rowHeight: 28, overscan: 6 });
// or: new TanStackVirtualizer({ estimateSize: () => 28 }) — then call virtualizer.measure(row, index)

const detach = virtualizer.attach(viewport, render);
virtualizer.setCount(state.visibleNodes().length);
virtualizer.items(); // [{ index, start, size }] — position rows with these, never index × height
virtualizer.totalSize(); // height of the scrollable content
```

### `DndEngine<T>` — pointer drag-and-drop

```ts
import { DndEngine } from '@treekit/core';

const dnd = new DndEngine<Sensor>({
  getVisibleNodes: () => state.visibleNodes(),
  canDropAt: (nodes, target) => state.canMoveMany(nodes, target), // invalid targets never light up
  onDrop: drop => drop.target && state.moveMany([...drop.nodes], drop.target),
  onStateChange: render, // redraw the folder highlight / insertion line
  springLoadDelay: 600, // expand a hovered folder mid-drag…
  onSpringLoad: node => state.expand(node), // …you decide to expand it
});
dnd.attach(viewport, content);

dnd.hoveredFolder(); // highlight this row
dnd.insertionLine(); // { top, left } — draw one line inside `content`
```

The engine binds native listeners on attach and finds rows with `elementFromPoint(…).closest('[data-node-id]')`. **It never inserts anything into the layout, and it never mutates the tree** — `onDrop` reports a `DropEvent` and your code applies it. Drags from outside the tree (any `draggable` element with `dataTransfer` data) arrive as drops with `nodes: []`.

The drop intent is the pure, exported `resolveDropIntent(isFolder, fraction)`: the middle half of a folder means `into`; otherwise the pointer's half picks `before` or `after`.

### `KeyboardController<T>` — ARIA navigation and keyboard drag-and-drop

```ts
import { KeyboardController } from '@treekit/core';

const keyboard = new KeyboardController<Sensor>({
  state,
  onDrop, // the same DropEvent as pointer drops
  canDropAt,
  announce: message => (liveRegion.textContent = message),
  scrollToIndex: index => virtualizer.scrollToIndex(index),
  onStateChange: render,
});
viewport.addEventListener(
  'keydown',
  event => keyboard.handleKeyDown(event) && event.preventDefault()
);
```

Arrows, Home/End and Left/Right navigate and expand; Space grabs, arrows step through the same into/before/after positions, Space drops, Escape cancels. Render `aria-activedescendant` from `keyboard.activeNode()`.

### `SelectionModel<T>` — multi-selection

```ts
import { SelectionModel } from '@treekit/core';

const selection = new SelectionModel<Sensor>({ state, onChange: render });
selection.selectOn(node, { ctrlOrMeta: event.metaKey || event.ctrlKey, shift: event.shiftKey });
selection.selectedNodes(); // visible selected nodes, in document order
```

Selection is stored by id (it survives `setSource`), `selectedNodes()` returns only visible nodes so hidden ones never ride along in a drag, and selecting a folder never implies its descendants. Pass it to `KeyboardController` (`selection`) and `DndEngine` (`getSelectedNodes`) for multi-node drags.

## API

| Export                                                                              | Kind      |
| ----------------------------------------------------------------------------------- | --------- |
| `TreeState`, `TreeStateOptions`                                                     | class     |
| `TreeNode`, `TreeInput`, `DropMode`, `DropTarget`, `DropEvent`                      | types     |
| `isDescendant`, `isDescendantOfAny`, `denestNodes`, `normalizeDragNodes`            | functions |
| `TreeVirtualizer`, `VirtualItem`                                                    | types     |
| `FixedHeightVirtualizer`, `FixedHeightVirtualizerOptions`                           | class     |
| `DndEngine`, `DndEngineOptions`, `InsertionTarget`, `InsertionLine`                 | class     |
| `resolveDropIntent`                                                                 | function  |
| `KeyboardController`, `KeyboardControllerOptions`, `KeyboardMessages`               | class     |
| `SelectionModel`, `SelectionModelOptions`, `SelectionModifiers`                     | class     |
| `TanStackVirtualizer`, `TanStackVirtualizerOptions` — from `@treekit/core/tanstack` | class     |

Every export carries TSDoc in its `.d.ts`. Limitations (touch drag on Android Chrome, fixed-height default, owned scroll viewport, RTL) are listed in the [repository README](https://github.com/Constantine-24/treekit#limitations).

## License

[MIT](https://github.com/Constantine-24/treekit/blob/main/LICENSE) © Konstantin Penzin
