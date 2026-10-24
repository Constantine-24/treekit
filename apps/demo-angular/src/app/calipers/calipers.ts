import { Component, input } from '@angular/core';
import { DropProbe } from 'demo-shared';

/** Calibration marks drawn over the row the pointer is resolving a drop against. */
@Component({
  selector: 'app-calipers',
  host: {
    class: 'calipers',
    'aria-hidden': 'true',
    '[class.into]': "probe().mode === 'into'",
    '[style.top.px]': 'probe().top',
    '[style.left.px]': 'probe().left',
    '[style.width.px]': 'probe().width',
    '[style.height.px]': 'probe().height',
  },
  template: `
    @if (probe().isFolder) {
      <span class="band"></span>
    }
    <span class="tick" style="top: 25%"></span>
    <span class="tick mid" style="top: 50%"></span>
    <span class="tick" style="top: 75%"></span>
    <span class="cursor" [style.top.%]="probe().fraction * 100"></span>
  `,
})
export class Calipers {
  readonly probe = input.required<DropProbe>();
}
