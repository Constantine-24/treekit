# @constantine-24/treekit-angular

[![npm](https://img.shields.io/npm/v/@constantine-24/treekit-angular?color=2f4fe0)](https://www.npmjs.com/package/@constantine-24/treekit-angular)
[![CI](https://github.com/Constantine-24/treekit/actions/workflows/ci.yml/badge.svg)](https://github.com/Constantine-24/treekit/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@constantine-24/treekit-angular)](https://github.com/Constantine-24/treekit/blob/main/LICENSE)

`<tk-tree>` — a virtualized Angular tree with native HTML5 drag-and-drop, keyboard-accessible drag-and-drop, multi-select, filtering and lazy loading, built on the headless [`@constantine-24/treekit-core`](https://www.npmjs.com/package/@constantine-24/treekit-core). Standalone, zoneless-ready, no Material or CDK dependency. Its React twin is [`@constantine-24/treekit-react`](https://www.npmjs.com/package/@constantine-24/treekit-react).

**[Angular showcase](https://constantine-24.github.io/treekit/angular/)** · [Landing page](https://constantine-24.github.io/treekit/) · [Repository](https://github.com/Constantine-24/treekit)

<img src="https://raw.githubusercontent.com/Constantine-24/treekit/main/docs/images/demo.png" alt="A live treekit tree of 10,001 nodes with 18 rows in the DOM" width="720">

## Installation

```bash
npm install @constantine-24/treekit-core @constantine-24/treekit-angular
```

Requires Angular 22 or later. For measured (variable-height) rows, also install `@tanstack/virtual-core`.

## Usage

```ts
import { Component } from '@angular/core';
import { TkTree, TkTreeNodeDef } from '@constantine-24/treekit-angular';
import { DropEvent, TreeState } from '@constantine-24/treekit-core';

@Component({
  selector: 'app-explorer',
  imports: [TkTree, TkTreeNodeDef],
  template: `
    <tk-tree [state]="state" [rowHeight]="28" ariaLabel="Files" (dropped)="onDrop($event)">
      <ng-template tkTreeNodeDef let-node>{{ node.name }}</ng-template>
    </tk-tree>
  `,
  styles: `
    tk-tree {
      height: 400px;
    }
  `,
})
export class Explorer {
  readonly state = new TreeState<FileItem>();

  constructor() {
    this.state.setSource(roots);
  }

  // The tree only reports the drop; your code applies it.
  onDrop(drop: DropEvent<FileItem>): void {
    if (drop.target) {
      this.state.moveMany([...drop.nodes], drop.target);
    }
  }
}
```

- You own the `TreeState` — filtering, lazy loading and mutations are [core](https://www.npmjs.com/package/@constantine-24/treekit-core) calls, and the tree re-renders on every change.
- `<tk-tree>` owns its scroll viewport, so give it a height.
- Variable row heights: pass a `TanStackVirtualizer` (from `@constantine-24/treekit-core/tanstack`) to `[virtualizer]`; rows measure themselves.

## Inputs

| Input                | Type                                               | Default | Description                                                                                 |
| -------------------- | -------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| `state`              | `TreeState<T>`                                     | —       | **Required.** The tree to render.                                                           |
| `virtualizer`        | `TreeVirtualizer \| null`                          | `null`  | Custom virtualizer; defaults to the built-in fixed-height one.                              |
| `rowHeight`          | `number`                                           | `32`    | Row height in px for the default virtualizer.                                               |
| `overscan`           | `number`                                           | `4`     | Extra rows above and below the viewport (applied on attach).                                |
| `isReadonly`         | `boolean`                                          | `false` | Disables all drag-and-drop.                                                                 |
| `selectedId`         | `string \| null`                                   | `null`  | Single-select highlight.                                                                    |
| `multiSelect`        | `boolean`                                          | `false` | ⌃/⌘-click, Shift-click, Shift+arrows, ⌃/⌘+A, and drags that carry the selection. See below. |
| `selectedIds`        | `readonly string[] \| ReadonlySet<string> \| null` | `null`  | Controlled selection; `[(selectedIds)]` binds two-way.                                      |
| `ariaLabel`          | `string \| null`                                   | `null`  | Accessible name of the tree.                                                                |
| `indentWidth`        | `number`                                           | `18`    | Indentation per level in px.                                                                |
| `autoScrollEdge`     | `number`                                           | `36`    | Distance from the viewport edge that auto-scrolls during a drag, in px.                     |
| `indentGuides`       | `boolean`                                          | `false` | Draws vertical guide lines down the indentation.                                            |
| `springLoadDelay`    | `number`                                           | `0`     | Hover time in ms before a collapsed folder expands mid-drag. `0` disables it.               |
| `dragHandleSelector` | `string \| null`                                   | `null`  | Only drags that start inside this selector are allowed.                                     |
| `isLoading`          | `boolean`                                          | `false` | Shows the `tkTreeLoading` template instead of rows.                                         |

## Outputs

| Output              | Payload                                    | Emitted when                                                  |
| ------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| `dropped`           | `DropEvent<T>`                             | A pointer or keyboard drop resolves. The tree is not mutated. |
| `nodeClick`         | `TreeNode<T>`                              | A row is clicked.                                             |
| `nodeDblClick`      | `TreeNode<T>`                              | A row is double-clicked.                                      |
| `nodeContextMenu`   | `{ event: MouseEvent; node: TreeNode<T> }` | A row is right-clicked (the native menu is suppressed).       |
| `selectedIdsChange` | `readonly string[]`                        | The selection changes.                                        |
| `selectionChange`   | `readonly TreeNode<T>[]`                   | The same change, as visible nodes in document order.          |
| `expanded`          | `TreeNode<T>`                              | A folder is expanded from its toggle (not programmatically).  |
| `collapsed`         | `TreeNode<T>`                              | A folder is collapsed from its toggle (not programmatically). |

## Multi-select

Set `[multiSelect]="true"` for ⌃/⌘-click, Shift-click ranges, `Ctrl/Cmd+A`, and drags that carry the whole selection. Read it back with `(selectedIdsChange)`, or drive it with `[(selectedIds)]`.

Note this rebinds one key: `Space` toggles selection and `Ctrl/Cmd+Space` grabs a row for keyboard drag-and-drop. Left off, `<tk-tree>` stays fully controlled — clicking emits `nodeClick` and never moves the highlight itself.

## Projected templates

| Template        | Renders                                                     |
| --------------- | ----------------------------------------------------------- |
| `tkTreeNodeDef` | Each row's content. Context: `$implicit` / `node`, `index`. |
| `tkTreeEmpty`   | Shown when no rows are visible.                             |
| `tkTreeLoading` | Shown while `[isLoading]` is set; wins over `tkTreeEmpty`.  |

## Imperative API

Get the component with `viewChild(TkTree)`: `expandAll()`, `collapseAll()`, and `scrollToNode(nodeOrId)` — the last returns `false` when the node is hidden by collapse or a filter, since there is no row to scroll to.

## Keyboard

| Keys                              | Action                                                   |
| --------------------------------- | -------------------------------------------------------- |
| ↑ ↓ · Home End                    | Move the active row                                      |
| → ←                               | Expand / collapse, or move to child / parent             |
| Space (⌃/⌘ Space in multi-select) | Grab the active row (or selection) for keyboard drag     |
| ↑ ↓ while grabbed                 | Step through drop positions; announced to screen readers |
| Space · Escape                    | Drop · cancel                                            |

## Theming

Row height and indentation are inputs (`rowHeight`, `indentWidth`); everything else is a CSS custom property set on `tk-tree` or any ancestor, each with a working fallback. `@constantine-24/treekit-react` uses the same properties.

| Property                     | Applies to                                     |
| ---------------------------- | ---------------------------------------------- |
| `--tk-text-color`            | Row text                                       |
| `--tk-text-muted-color`      | Empty/loading template text                    |
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
| `--tk-indent-guide-color`    | Indent guides (with `[indentGuides]="true"`)   |
| `--tk-placeholder-padding`   | Padding around the empty/loading templates     |

## Limitations

Native HTML5 drag doesn't fire from touch on Android Chrome (keyboard drag is the fallback), the default virtualizer assumes a fixed row height, and RTL is untested. Details in the [repository README](https://github.com/Constantine-24/treekit#limitations).

## License

[MIT](https://github.com/Constantine-24/treekit/blob/main/LICENSE) © Konstantin Penzin
