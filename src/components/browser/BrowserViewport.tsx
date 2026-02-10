import { useAutomation } from '../../context/AutomationContext';
import { GoogleSearchPage } from '../../pages/GoogleSearchPage';
import { WixGuesthousePage } from '../../pages/WixGuesthousePage';
import { BookingListingPage } from '../../pages/BookingListingPage';
import { AgodaListingPage } from '../../pages/AgodaListingPage';
import { ResearchTrackerPage } from '../../pages/ResearchTrackerPage';
import { MaxLevelOpsPage } from '../../pages/MaxLevelOpsPage';
import { SimulatedCursor } from './SimulatedCursor';
import { HighlightOverlay } from './HighlightOverlay';

const PAGE_COMPONENTS: Record<string, React.FC> = {
  'google-search': GoogleSearchPage,
  'wix-guesthouse': WixGuesthousePage,
  'booking-listing': BookingListingPage,
  'agoda-listing': AgodaListingPage,
  'research-tracker': ResearchTrackerPage,
  'maxlevel-ops': MaxLevelOpsPage,
};

export function BrowserViewport() {
  const { execution } = useAutomation();
  const PageComponent = PAGE_COMPONENTS[execution.currentPage] || GoogleSearchPage;

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
