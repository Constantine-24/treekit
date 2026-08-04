---
'@treekit/core': minor
'@treekit/angular': minor
---

Add multi-select and multi-node drag.

`SelectionModel` joins the core as a fifth layer, with click/ctrl/shift semantics, anchored
ranges over the visible list, and id-based storage that survives node churn. `TreeState` gains
`moveMany`/`canMoveMany`, and `move` now delegates to them. The exported `denestNodes` and
`normalizeDragNodes` normalize a drag payload to document order, de-duplicated and de-nested.

`<tk-tree>` gains `multiSelect`, `selectedIds`, `selectedIdsChange` and `selectionChange`, plus
`aria-multiselectable` and per-row `aria-selected`. With `multiSelect` off the component behaves
exactly as before, staying fully controlled.

Also fixes variable-height virtualization in Angular: `TreeVirtualizer.measure` was never called,
so `TanStackVirtualizer`'s measured rows had no effect. The new `TkTreeRowMeasure` directive
reports rows, and measured rows no longer have their height pinned to the estimate.

Breaking changes (pre-1.0):

- `DropEvent` gains a required `nodes` array. `node` is now defined as the first of `nodes` in
  document order, so it is always a member of `nodes`.
- `canDropAt` on `DndEngine` and `KeyboardController` takes `readonly TreeNode<T>[]` instead of
  `TreeNode<T> | null`; `[]` replaces `null` as the external-drag sentinel. Wire it to
  `canMoveMany`.
- `KeyboardMessages` callbacks take node arrays, and gain `selectionChanged`.
- With a `SelectionModel` wired, `Space` toggles selection and `Ctrl/Cmd+Space` grabs a row for
  keyboard drag-and-drop. With no selection wired, `Space` still grabs.
