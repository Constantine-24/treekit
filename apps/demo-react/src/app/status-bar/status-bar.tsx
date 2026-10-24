import { DropProbe, formatFraction } from '@treekit/demo-shared';
import { ReactElement } from 'react';

/**
 * The readout strip. Idle it carries the status line; during a drag it shows
 * the library's real drop arithmetic for the row under the pointer.
 */
export function StatusBar({
  probe,
  status,
}: {
  probe: DropProbe | null;
  status: string;
}): ReactElement {
  let className = 'status-bar';
  if (probe) className += ' live';
  if (probe?.mode === 'into') className += ' into';

  return (
    <div className={className}>
      {probe ? (
        <>
          <span className="label">Drop</span>
          <span className="cell">
            <i>row</i>
            {probe.name}
          </span>
          <span className="cell">
            <i>folder</i>
            {String(probe.isFolder)}
          </span>
          <span className="cell">
            <i>fraction</i>
            {formatFraction(probe.fraction)}
          </span>
          <span className="cell intent">
            <i>intent</i>
            {probe.mode}
          </span>
          <code>
            resolveDropIntent({String(probe.isFolder)}, {formatFraction(probe.fraction)})
          </code>
        </>
      ) : (
        <>
          <span className="label">Status</span>
          <span className="status">{status || 'Ready'}</span>
        </>
      )}
    </div>
  );
}
