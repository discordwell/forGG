import { useAutomation } from '../../context/AutomationContext';
import { MaxLevelOpsPage } from '../../pages/MaxLevelOpsPage';
import { SimulatedCursor } from './SimulatedCursor';
import { HighlightOverlay } from './HighlightOverlay';

const PAGE_COMPONENTS: Record<string, React.FC> = {
  'maxlevel-ops': MaxLevelOpsPage,
};

export function BrowserViewport() {
  const { execution } = useAutomation();
  const PageComponent = PAGE_COMPONENTS[execution.currentPage] || MaxLevelOpsPage;

  return (
    <div className="flex-1 relative overflow-hidden">
      {/* Page content */}
      <div className="absolute inset-0 overflow-auto">
        <PageComponent />
      </div>

      {/* Overlays */}
      <HighlightOverlay />
      <SimulatedCursor />
    </div>
  );
}
