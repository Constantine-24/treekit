import { Component, input, output } from '@angular/core';
import { FEATURE_TOGGLES, FeatureToggleKey } from 'demo-shared';

/** Filter, expand/collapse all, and the feature switches. */
@Component({
  selector: 'app-toolbar',
  host: { class: 'toolbar' },
  template: `
    <input
      #filter
      type="search"
      class="filter"
      placeholder="Filter rows…"
      aria-label="Filter rows"
      (input)="filterChange.emit(filter.value)"
    />
    <button type="button" class="ghost" (click)="expandAll.emit()">Expand all</button>
    <button type="button" class="ghost" (click)="collapseAll.emit()">Collapse all</button>
    <span class="spacer"></span>
    @for (toggle of featureToggles; track toggle.key) {
      <label class="switch">
        <input
          type="checkbox"
          [checked]="toggles()[toggle.key]"
          (change)="toggleChange.emit({ key: toggle.key, value: !toggles()[toggle.key] })"
        />
        <span>{{ toggle.label }}</span>
      </label>
    }
  `,
})
export class Toolbar {
  readonly toggles = input.required<Record<FeatureToggleKey, boolean>>();

  readonly filterChange = output<string>();
  readonly toggleChange = output<{ key: FeatureToggleKey; value: boolean }>();
  readonly expandAll = output<void>();
  readonly collapseAll = output<void>();

  protected readonly featureToggles = FEATURE_TOGGLES;
}
