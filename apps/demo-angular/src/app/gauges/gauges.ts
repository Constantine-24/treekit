import { Component, input } from '@angular/core';
import { formatCount, GAUGES, GaugeKey } from '@treekit/demo-shared';

/** The rail's live counters: total, visible, rendered and selected rows. */
@Component({
  selector: 'app-gauges',
  template: `
    <dl class="gauges">
      @for (gauge of gauges; track gauge.key) {
        <div class="gauge" [class.accent]="gauge.accent">
          <dt class="label">{{ gauge.label }}</dt>
          <dd>{{ format(counts()[gauge.key]) }}</dd>
        </div>
      }
    </dl>
  `,
})
export class Gauges {
  readonly counts = input.required<Record<GaugeKey, number>>();

  protected readonly gauges = GAUGES;
  protected readonly format = formatCount;
}
