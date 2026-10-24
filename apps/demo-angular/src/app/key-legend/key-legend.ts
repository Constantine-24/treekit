import { Component } from '@angular/core';
import { KEY_LEGEND } from '@treekit/demo-shared';

/** The multi-select key bindings. */
@Component({
  selector: 'app-key-legend',
  host: { class: 'key-legend' },
  template: `
    <h2 class="label">Keys</h2>
    <dl>
      @for (binding of bindings; track binding.keys) {
        <dt>{{ binding.keys }}</dt>
        <dd>{{ binding.action }}</dd>
      }
    </dl>
  `,
})
export class KeyLegend {
  protected readonly bindings = KEY_LEGEND;
}
