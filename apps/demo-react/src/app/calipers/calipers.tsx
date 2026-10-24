import { DropProbe } from 'demo-shared';
import { ReactElement } from 'react';

/** Calibration marks drawn over the row the pointer is resolving a drop against. */
export function Calipers({ probe }: { probe: DropProbe }): ReactElement {
  return (
    <div
      className={probe.mode === 'into' ? 'calipers into' : 'calipers'}
      aria-hidden="true"
      style={{ top: probe.top, left: probe.left, width: probe.width, height: probe.height }}
    >
      {probe.isFolder && <span className="band" />}
      <span className="tick" style={{ top: '25%' }} />
      <span className="tick mid" style={{ top: '50%' }} />
      <span className="tick" style={{ top: '75%' }} />
      <span className="cursor" style={{ top: `${probe.fraction * 100}%` }} />
    </div>
  );
}
