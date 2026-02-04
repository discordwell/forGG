import { StepBuilderPanel } from './step-builder/StepBuilderPanel';
import { BrowserChrome } from './browser/BrowserChrome';
import { AuditTrailPanel } from './audit-trail/AuditTrailPanel';

export function MainLayout() {
  return (
    <div className="flex flex-1 min-h-0">
      <StepBuilderPanel />
      <BrowserChrome />
      <AuditTrailPanel />
    </div>
  );
}
