import React, { useCallback, useMemo, useState } from 'react';
import WarningCallout from './WarningCallout';
import {
  buildWarningPanels,
  createWarningPanelState,
} from '../utils/resultsWarnings.jsx';

export default function ResultsWarningPanels({
  warningGroups,
  fitOversized,
  renderDisclosureIcon,
}) {
  const [panelState, setPanelState] = useState(createWarningPanelState);

  const togglePanel = useCallback((panelId) => {
    setPanelState((prev) => ({
      ...prev,
      [panelId]: !prev[panelId],
    }));
  }, []);

  const warningPanels = useMemo(
    () =>
      buildWarningPanels({
        warningGroups,
        fitOversized,
        panelState,
        onTogglePanel: togglePanel,
      }),
    [fitOversized, panelState, togglePanel, warningGroups]
  );

  const totalWarningPanels = warningPanels.length;

  if (totalWarningPanels === 0) {
    return null;
  }

  return (
    <div className={`results-warnings callout-grid callout-count-${totalWarningPanels}`}>
      {warningPanels.map((panel) => (
        <WarningCallout
          key={panel.id}
          variant={panel.variant}
          expanded={panel.expanded}
          onToggle={panel.onToggle}
          renderToggleIcon={renderDisclosureIcon}
          icon={panel.icon}
          title={panel.title}
          count={panel.count}
          description={panel.description}
          items={panel.items}
          renderItem={panel.renderItem}
        />
      ))}
    </div>
  );
}


