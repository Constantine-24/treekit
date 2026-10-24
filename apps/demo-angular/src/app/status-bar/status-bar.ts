import { Component, input } from '@angular/core';
import { DropProbe, formatFraction } from 'demo-shared';

/**
 * The readout strip. Idle it carries the status line; during a drag it shows
 * the library's real drop arithmetic for the row under the pointer.
 */
@Component({
  selector: 'app-status-bar',
  host: {
    class: 'status-bar',
    '[class.live]': 'probe()',
    '[class.into]': "probe()?.mode === 'into'",
  },
  template: `
    @if (probe(); as reading) {
      <span class="label">Drop</span>
      <span class="cell"><i>row</i>{{ reading.name }}</span>
      <span class="cell"><i>folder</i>{{ reading.isFolder }}</span>
      <span class="cell"><i>fraction</i>{{ format(reading.fraction) }}</span>
      <span class="cell intent"><i>intent</i>{{ reading.mode }}</span>
      <code>resolveDropIntent({{ reading.isFolder }}, {{ format(reading.fraction) }})</code>
    } @else {
      <span class="label">Status</span>
      <span class="status">{{ status() || 'Ready' }}</span>
    }
  `,
})
export class StatusBar {
  readonly probe = input<DropProbe | null>(null);
  readonly status = input('');

  protected readonly format = formatFraction;
}
