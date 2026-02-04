import { useAutomation } from '../../context/AutomationContext';
import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { CustomerProfilePage } from '../../pages/CustomerProfilePage';
import { AlertReviewPage } from '../../pages/AlertReviewPage';
import { DocumentViewerPage } from '../../pages/DocumentViewerPage';
import { SimulatedCursor } from './SimulatedCursor';
import { HighlightOverlay } from './HighlightOverlay';

const PAGE_COMPONENTS: Record<string, React.FC> = {
  login: LoginPage,
  dashboard: DashboardPage,
  'customer-profile': CustomerProfilePage,
  'alert-review': AlertReviewPage,
  'document-viewer': DocumentViewerPage,
};

export function BrowserViewport() {
  const { execution } = useAutomation();
  const PageComponent = PAGE_COMPONENTS[execution.currentPage] || LoginPage;

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
