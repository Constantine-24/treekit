import { KEY_LEGEND } from '@treekit/demo-shared';
import { Fragment, ReactElement } from 'react';

/** The multi-select key bindings. */
export function KeyLegend(): ReactElement {
  return (
    <section className="key-legend">
      <h2 className="label">Keys</h2>
      <dl>
        {KEY_LEGEND.map(binding => (
          <Fragment key={binding.keys}>
            <dt>{binding.keys}</dt>
            <dd>{binding.action}</dd>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}
