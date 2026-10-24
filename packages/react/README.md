# @constantine-24/treekit-react

[![npm](https://img.shields.io/npm/v/@constantine-24/treekit-react?color=2f4fe0)](https://www.npmjs.com/package/@constantine-24/treekit-react)
[![CI](https://github.com/Constantine-24/treekit/actions/workflows/ci.yml/badge.svg)](https://github.com/Constantine-24/treekit/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@constantine-24/treekit-react)](https://github.com/Constantine-24/treekit/blob/main/LICENSE)

`<TkTree>` — a virtualized React tree with native HTML5 drag-and-drop, keyboard-accessible drag-and-drop, multi-select, filtering and lazy loading, built on the headless [`@constantine-24/treekit-core`](https://www.npmjs.com/package/@constantine-24/treekit-core). For React 18 and 19. Its Angular twin is [`@constantine-24/treekit-angular`](https://www.npmjs.com/package/@constantine-24/treekit-angular).

**[React showcase](https://constantine-24.github.io/treekit/react/)** · [Landing page](https://constantine-24.github.io/treekit/) · [Repository](https://github.com/Constantine-24/treekit)

<img src="https://raw.githubusercontent.com/Constantine-24/treekit/main/docs/images/demo.png" alt="A live treekit tree of 10,001 nodes with 18 rows in the DOM" width="720">

## Installation

```bash
npm install @constantine-24/treekit-core @constantine-24/treekit-react
```

For measured (variable-height) rows, also install `@tanstack/virtual-core`.

## Usage

```tsx
import { TreeState } from '@constantine-24/treekit-core';
import { TkTree } from '@constantine-24/treekit-react';
import '@constantine-24/treekit-react/styles.css'; // once, anywhere in your app
import { useState } from 'react';

export function Explorer() {
  const [state] = useState(() => {
    const tree = new TreeState<FileItem>();
    tree.setSource(roots);
    return tree;
  });

  return (
    <div style={{ height: 400 }}>
      <TkTree
        state={state}
        rowHeight={28}
        ariaLabel="Files"
        renderNode={node => <span>{node.name}</span>}
        // The tree only reports the drop; your code applies it.
        onDrop={drop => {
          if (drop.target) state.moveMany([...drop.nodes], drop.target);
        }}
      />
    </div>
  );
}
```

- You own the `TreeState` — create it once (`useState(() => …)`), and call [core](https://www.npmjs.com/package/@constantine-24/treekit-core) methods to filter, load or mutate it. The tree subscribes and re-renders on every change; you don't need to copy anything into React state.
- Inline callbacks are fine: the tree reads the latest props on every event and never re-attaches its engines (or drops focus and in-flight drags) because a callback changed identity. Changing `state` or `virtualizer` re-attaches.
- `<TkTree>` owns its scroll viewport, so give its container a height.
- It is a client component (`'use client'`); it works in Next.js App Router and other RSC setups as a client boundary.
- Variable row heights: pass a `TanStackVirtualizer` (from `@constantine-24/treekit-core/tanstack`) as `virtualizer`; rows measure themselves.

## Props

| Prop                 | Type                                               | Default | Description                                                                                 |
| -------------------- | -------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| `state`              | `TreeState<T>`                                     | —       | **Required.** The tree to render.                                                           |
| `virtualizer`        | `TreeVirtualizer \| null`                          | `null`  | Custom virtualizer; defaults to the built-in fixed-height one.                              |
| `rowHeight`          | `number`                                           | `32`    | Row height in px for the default virtualizer.                                               |
| `overscan`           | `number`                                           | `4`     | Extra rows above and below the viewport (applied on attach).                                |
| `isReadonly`         | `boolean`                                          | `false` | Disables all drag-and-drop.                                                                 |
| `selectedId`         | `string \| null`                                   | `null`  | Single-select highlight.                                                                    |
| `multiSelect`        | `boolean`                                          | `false` | ⌃/⌘-click, Shift-click, Shift+arrows, ⌃/⌘+A, and drags that carry the selection. See below. |
| `selectedIds`        | `readonly string[] \| ReadonlySet<string> \| null` | `null`  | Controlled selection; pair with `onSelectedIdsChange`.                                      |
| `ariaLabel`          | `string`                                           | —       | Accessible name of the tree.                                                                |
| `indentWidth`        | `number`                                           | `18`    | Indentation per level in px.                                                                |
| `autoScrollEdge`     | `number`                                           | `36`    | Distance from the viewport edge that auto-scrolls during a drag, in px.                     |
| `indentGuides`       | `boolean`                                          | `false` | Draws vertical guide lines down the indentation.                                            |
| `springLoadDelay`    | `number`                                           | `0`     | Hover time in ms before a collapsed folder expands mid-drag. `0` disables it.               |
| `dragHandleSelector` | `string \| null`                                   | `null`  | Only drags that start inside this selector are allowed.                                     |
| `isLoading`          | `boolean`                                          | `false` | Shows `renderLoading` instead of rows.                                                      |
| `renderNode`         | `(node, { index, row }) => ReactNode`              | name    | A row's content.                                                                            |
| `renderEmpty`        | `() => ReactNode`                                  | —       | Shown when no rows are visible.                                                             |
| `renderLoading`      | `() => ReactNode`                                  | —       | Shown while `isLoading`; wins over `renderEmpty`.                                           |
| `className`, `style` | —                                                  | —       | Applied to the host element (which always has the `tk-tree` class).                         |

## Callbacks

| Callback              | Payload                                    | Called when                                                   |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| `onDrop`              | `DropEvent<T>`                             | A pointer or keyboard drop resolves. The tree is not mutated. |
| `onNodeClick`         | `TreeNode<T>`                              | A row is clicked.                                             |
| `onNodeDoubleClick`   | `TreeNode<T>`                              | A row is double-clicked.                                      |
| `onNodeContextMenu`   | `{ event: MouseEvent; node: TreeNode<T> }` | A row is right-clicked (the native menu is suppressed).       |
| `onSelectedIdsChange` | `readonly string[]`                        | The selection changes.                                        |
| `onSelectionChange`   | `readonly TreeNode<T>[]`                   | The same change, as visible nodes in document order.          |
| `onExpand`            | `TreeNode<T>`                              | A folder is expanded from its toggle (not programmatically).  |
| `onCollapse`          | `TreeNode<T>`                              | A folder is collapsed from its toggle (not programmatically). |

## Multi-select

Pass `multiSelect` for ⌃/⌘-click, Shift-click ranges, `Ctrl/Cmd+A`, and drags that carry the whole selection. Read it back with `onSelectedIdsChange`, or control it:

```tsx
const [ids, setIds] = useState<readonly string[]>([]);
<TkTree state={state} multiSelect selectedIds={ids} onSelectedIdsChange={setIds} />;
```

Note this rebinds one key: `Space` toggles selection and `Ctrl/Cmd+Space` grabs a row for keyboard drag-and-drop. Left off, `<TkTree>` stays fully controlled — clicking calls `onNodeClick` and never moves the highlight itself.

## Imperative handle

```tsx
const tree = useRef<TkTreeHandle<FileItem>>(null);
<TkTree ref={tree} state={state} />;

tree.current?.expandAll();
tree.current?.collapseAll();
tree.current?.scrollToNode('readme'); // false if the node is hidden by collapse or a filter
```

## Keyboard

| Keys                              | Action                                                   |
| --------------------------------- | -------------------------------------------------------- |
| ↑ ↓ · Home End                    | Move the active row                                      |
| → ←                               | Expand / collapse, or move to child / parent             |
| Space (⌃/⌘ Space in multi-select) | Grab the active row (or selection) for keyboard drag     |
| ↑ ↓ while grabbed                 | Step through drop positions; announced to screen readers |
| Space · Escape                    | Drop · cancel                                            |

## Theming

Import `@constantine-24/treekit-react/styles.css` once, then theme through CSS custom properties on `.tk-tree` or any ancestor (or the `style` prop). Row height and indentation are props. The properties are the same as `@constantine-24/treekit-angular`'s:

| Property                     | Applies to                                     |
| ---------------------------- | ---------------------------------------------- |
| `--tk-text-color`            | Row text                                       |
| `--tk-text-muted-color`      | Empty/loading placeholder text                 |
| `--tk-hover-bg`              | Row hover background                           |
| `--tk-selected-bg`           | Selected row background                        |
| `--tk-focus-color`           | Focus ring, active-row outline, folder outline |
| `--tk-drop-bg`               | Highlight on a folder accepting an `into` drop |
| `--tk-insertion-color`       | The between-rows insertion line and its dot    |
| `--tk-insertion-inset-right` | Right inset of the insertion line              |
| `--tk-node-gap`              | Gap between toggle and row content             |
| `--tk-node-padding-inline`   | Row right padding                              |
| `--tk-node-radius`           | Row corner radius                              |
| `--tk-toggle-size`           | Chevron box size                               |
| `--tk-toggle-color`          | Chevron colour                                 |
| `--tk-spinner-color`         | Lazy-load spinner arc                          |
| `--tk-spinner-track`         | Lazy-load spinner track                        |
| `--tk-indent-guide-color`    | Indent guides (with `indentGuides`)            |
| `--tk-placeholder-padding`   | Padding around the empty/loading placeholders  |

## Limitations

Native HTML5 drag doesn't fire from touch on Android Chrome (keyboard drag is the fallback), the default virtualizer assumes a fixed row height, and RTL is untested. Details in the [repository README](https://github.com/Constantine-24/treekit#limitations).

## License

[MIT](https://github.com/Constantine-24/treekit/blob/main/LICENSE) © Konstantin Penzin
