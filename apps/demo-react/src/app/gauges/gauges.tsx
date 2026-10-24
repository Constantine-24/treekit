import { formatCount, GAUGES, GaugeKey } from '@treekit/demo-shared';
import { ReactElement } from 'react';

/** The rail's live counters: total, visible, rendered and selected rows. */
export function Gauges({ counts }: { counts: Record<GaugeKey, number> }): ReactElement {
  return (
    <dl className="gauges">
      {GAUGES.map(gauge => (
        <div key={gauge.key} className={gauge.accent ? 'gauge accent' : 'gauge'}>
          <dt className="label">{gauge.label}</dt>
          <dd>{formatCount(counts[gauge.key])}</dd>
        </div>
      ))}
    </dl>
  );
}
