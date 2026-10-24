import { PALETTE_LABELS, startPaletteDrag } from '@treekit/demo-shared';
import { ReactElement } from 'react';

/** External drag sources: plain `draggable` chips the tree accepts with no integration. */
export function Palette({ onDragEnd }: { onDragEnd: () => void }): ReactElement {
  return (
    <section className="palette">
      <h2 className="label">Palette</h2>
      <p className="hint">Drag a chip onto a row, or press ⌃/⌘ Space on a row to grab it.</p>
      <ul>
        {PALETTE_LABELS.map(label => (
          <li
            key={label}
            className="chip"
            draggable
            onDragStart={event => startPaletteDrag(event.nativeEvent, label)}
            onDragEnd={onDragEnd}
          >
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
