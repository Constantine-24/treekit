import { Component, output } from '@angular/core';
import { PALETTE_LABELS, startPaletteDrag } from 'demo-shared';

/** External drag sources: plain `draggable` chips the tree accepts with no integration. */
@Component({
  selector: 'app-palette',
  host: { class: 'palette' },
  template: `
    <h2 class="label">Palette</h2>
    <p class="hint">Drag a chip onto a row, or press ⌃/⌘ Space on a row to grab it.</p>
    <ul>
      @for (label of labels; track label) {
        <li
          class="chip"
          draggable="true"
          (dragstart)="onDragStart($event, label)"
          (dragend)="dragEnded.emit()"
        >
          {{ label }}
        </li>
      }
    </ul>
  `,
})
export class Palette {
  /** A chip drag finished, wherever it was dropped. */
  readonly dragEnded = output<void>();

  protected readonly labels = PALETTE_LABELS;

  protected onDragStart(event: DragEvent, label: string): void {
    startPaletteDrag(event, label);
  }
}
