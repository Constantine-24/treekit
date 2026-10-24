import { Directive, effect, ElementRef, inject, input } from '@angular/core';
import type { TreeVirtualizer } from '@constantine-24/treekit-core';

/**
 * Reports a rendered row element to the active virtualizer for measurement.
 *
 * Variable-height virtualizers need each row's real laid-out size, and
 * `TreeVirtualizer.measure` is how they receive it. Re-measurement is the
 * virtualizer's own job — `TanStackVirtualizer` observes every element it is
 * handed — so this directive only reports the element, and re-reports when the
 * row is recycled to a different index.
 *
 * It is applied to every row and is inert against a fixed-height virtualizer,
 * which implements no `measure`.
 */
@Directive({
  selector: '[tkTreeRowMeasure]',
})
export class TkTreeRowMeasure {
  /** The measuring virtualizer, or `null` when the active one does not measure. */
  readonly virtualizer = input.required<TreeVirtualizer | null>({ alias: 'tkTreeRowMeasure' });

  /** Index into the visible-nodes list of the row this element renders. */
  readonly index = input.required<number>({ alias: 'tkTreeRowMeasureIndex' });

  private readonly _element = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    effect(() => {
      const virtualizer = this.virtualizer();
      const index = this.index();
      virtualizer?.measure?.(this._element.nativeElement, index);
    });
  }
}
