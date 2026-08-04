import { Directive, inject, TemplateRef } from '@angular/core';

/**
 * Marks the template shown when the tree has no visible rows.
 *
 * ```html
 * <tk-tree [state]="state">
 *   <ng-template tkTreeEmpty>No sensors match this filter.</ng-template>
 * </tk-tree>
 * ```
 *
 * Left unset, an empty tree simply renders nothing.
 */
@Directive({
  selector: 'ng-template[tkTreeEmpty]',
})
export class TkTreeEmptyDef {
  readonly template = inject(TemplateRef<void>);
}

/**
 * Marks the template shown while the whole tree is loading, which takes
 * precedence over the empty template.
 *
 * This is the tree-level state; a single branch loading its children lazily
 * renders the per-row spinner from `TreeNode.isLoading` instead.
 */
@Directive({
  selector: 'ng-template[tkTreeLoading]',
})
export class TkTreeLoadingDef {
  readonly template = inject(TemplateRef<void>);
}
