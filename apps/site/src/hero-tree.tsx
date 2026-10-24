import { DropEvent } from '@constantine-24/treekit-core';
import {
  applyDrop,
  createDemoState,
  createVirtualizer,
  DemoItem,
  formatCount,
  generateForest,
  nameFilter,
  observeRenderedRows,
  ROW_HEIGHT,
  SPRING_LOAD_DELAY,
} from 'demo-shared';
import { TkTree } from '@constantine-24/treekit-react';
import {
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

/** The live tree in the hero: the real component over the showcase's 10,000 rows. */
export function HeroTree(): ReactElement {
  const [state] = useState(() => {
    const demoState = createDemoState();
    demoState.setSource(generateForest());
    return demoState;
  });
  const [virtualizer] = useState(() => createVirtualizer(false));
  const [status, setStatus] = useState('Drag a row, or focus the tree and press ⌃/⌘ Space.');
  const [rendered, setRendered] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const addedCounter = useRef(0);

  const subscribe = useCallback((listener: () => void) => state.subscribe(listener), [state]);
  const total = useSyncExternalStore(subscribe, () => state.nodes().length);

  useEffect(() => observeRenderedRows(panelRef.current!, setRendered), []);

  const onDrop = (drop: DropEvent<DemoItem>) => {
    const result = applyDrop(state, drop, () => `added-${addedCounter.current++}`);
    if (result) {
      setStatus(result);
    }
  };

  return (
    <figure className="hero-tree" aria-label="Live demo">
      <div className="hero-tree-bar">
        <span className="pulse" aria-hidden="true" />
        <span className="label">Live</span>
        <span className="readout">
          <span>{formatCount(total)}</span> nodes · <span className="accent">{rendered}</span> in
          the DOM
        </span>
      </div>
      <input
        type="search"
        className="hero-filter"
        placeholder="Filter 10,000 rows…"
        aria-label="Filter rows"
        onChange={event => state.setFilter(nameFilter(event.target.value))}
      />
      <div ref={panelRef} className="hero-tree-screen">
        <TkTree
          state={state}
          virtualizer={virtualizer}
          rowHeight={ROW_HEIGHT}
          multiSelect
          indentGuides
          springLoadDelay={SPRING_LOAD_DELAY}
          ariaLabel="Sensor hierarchy"
          onDrop={onDrop}
          onNodeClick={node => setStatus(node.name)}
          renderNode={node => (
            <>
              <span className="row-name">{node.name}</span>
              {node.item.unit && <span className="row-unit">{node.item.unit}</span>}
            </>
          )}
          renderEmpty={() => <span className="label">No rows match that filter</span>}
        />
      </div>
      <figcaption className="hero-tree-status">{status}</figcaption>
    </figure>
  );
}
