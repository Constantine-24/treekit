import { FEATURE_TOGGLES, FeatureToggleKey } from '@treekit/demo-shared';
import { ReactElement } from 'react';

export interface ToolbarProps {
  toggles: Record<FeatureToggleKey, boolean>;
  onFilterChange: (query: string) => void;
  onToggleChange: (key: FeatureToggleKey, value: boolean) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

/** Filter, expand/collapse all, and the feature switches. */
export function Toolbar({
  toggles,
  onFilterChange,
  onToggleChange,
  onExpandAll,
  onCollapseAll,
}: ToolbarProps): ReactElement {
  return (
    <div className="toolbar">
      <input
        type="search"
        className="filter"
        placeholder="Filter rows…"
        aria-label="Filter rows"
        onChange={event => onFilterChange(event.target.value)}
      />
      <button type="button" className="ghost" onClick={onExpandAll}>
        Expand all
      </button>
      <button type="button" className="ghost" onClick={onCollapseAll}>
        Collapse all
      </button>
      <span className="spacer" />
      {FEATURE_TOGGLES.map(toggle => (
        <label key={toggle.key} className="switch">
          <input
            type="checkbox"
            checked={toggles[toggle.key]}
            onChange={() => onToggleChange(toggle.key, !toggles[toggle.key])}
          />
          <span>{toggle.label}</span>
        </label>
      ))}
    </div>
  );
}
