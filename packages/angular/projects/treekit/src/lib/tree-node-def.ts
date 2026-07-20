import { Directive, inject, TemplateRef } from '@angular/core';
import type { TreeNode } from '@treekit/core';

/** Template context available inside `ng-template[tkTreeNodeDef]`. */
export interface TkTreeNodeDefContext<T> {
  $implicit: TreeNode<T>;
  node: TreeNode<T>;
  index: number;
}

/**
 * Marks the projected template used to render each tree row's content.
 *
 * ```html
 * <tk-tree [state]="state">
 *   <ng-template tkTreeNodeDef let-node>{{ node.name }}</ng-template>
 * </tk-tree>
 * ```
 */
@Directive({
  selector: 'ng-template[tkTreeNodeDef]',
})
export class TkTreeNodeDef<T> {
  readonly template = inject(TemplateRef<TkTreeNodeDefContext<T>>);

  static ngTemplateContextGuard<T>(
    _directive: TkTreeNodeDef<T>,
    context: unknown,
  ): context is TkTreeNodeDefContext<T> {
    return true;
  }
}
