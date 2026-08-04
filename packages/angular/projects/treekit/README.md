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
    <tk-tree [state]="state" [rowHeight]="28" (dropped)="onDrop($event)">
      <ng-template tkTreeNodeDef let-node>{{ node.name }}</ng-template>
    </tk-tree>
  `,
})
export class Explorer {
  state = new TreeState<MyItem>();

  onDrop(drop: DropEvent<MyItem>): void {
    if (drop.target) {
      this.state.moveMany([...drop.nodes], drop.target);
    }
  }
}
```

- The consumer owns the `TreeState` — filtering, lazy loading, and mutations are core API calls.
- Variable row heights: pass a `TanStackVirtualizer` (from `@treekit/core/tanstack`) to the
  `virtualizer` input. Rows measure themselves automatically.
- Full documentation, demos, and the limitations list live in the
  [repository README](https://github.com/kpenzin/treekit#readme).

## Multi-select

Set `[multiSelect]="true"` for ctrl/cmd-click, shift-click ranges, `Ctrl/Cmd+A`, and drags that
carry the whole selection. Read it back with `(selectedIdsChange)`, or drive it with
`[(selectedIds)]`.

Note this rebinds one key: `Space` toggles selection and `Ctrl/Cmd+Space` grabs a row for keyboard
drag-and-drop. Left off, `<tk-tree>` stays fully controlled — clicking emits `nodeClick` and never
moves the highlight itself.

## Projected templates

| Template        | Renders                                                     |
| --------------- | ----------------------------------------------------------- |
| `tkTreeNodeDef` | Each row's content. Context: `$implicit` / `node`, `index`. |
| `tkTreeEmpty`   | Shown when no rows are visible.                             |
| `tkTreeLoading` | Shown while `[isLoading]` is set; wins over `tkTreeEmpty`.  |

## Imperative API

`expandAll()`, `collapseAll()`, and `scrollToNode(nodeOrId)` — the last returns `false` when the
node is hidden by collapse or a filter, since there is no row to scroll to.

## Theming

Row height and indentation are inputs (`rowHeight`, `indentWidth`); everything else is a CSS
custom property set on `tk-tree`, each with a working fallback.

| Property                     | Applies to                                     |
| ---------------------------- | ---------------------------------------------- |
| `--tk-text-color`            | Row text                                       |
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
| `--tk-text-muted-color`      | Empty/loading template text                    |

MIT © Konstantin Penzin
