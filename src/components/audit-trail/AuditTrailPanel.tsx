import { useRef, useEffect } from 'react';
import { ScrollText } from 'lucide-react';
import { useAutomation } from '../../context/AutomationContext';
import { AuditEntry } from './AuditEntry';
import { AuditSummary } from './AuditSummary';

export function AuditTrailPanel() {
  const { execution } = useAutomation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest entry
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [execution.auditLog.length]);

  return (
    <div className="w-[340px] flex-shrink-0 bg-white border-l border-surface-200 flex flex-col h-full">
      <div className="px-4 py-3 border-b border-surface-200">
        <div className="flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-forge-600" />
          <h2 className="text-sm font-semibold text-surface-800">Audit Trail</h2>
        </div>
        <p className="text-[10px] text-surface-500 mt-0.5">
          {execution.auditLog.length} entries logged
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {execution.auditLog.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-surface-400">
            <ScrollText className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">No entries yet</p>
            <p className="text-[10px] mt-0.5">Run the automation to see audit logs</p>
          </div>
        ) : (
          <div className="space-y-0">
            {execution.auditLog.map((entry) => (
              <AuditEntry key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {(execution.status === 'completed' || execution.status === 'error') && (
        <div className="p-4 border-t border-surface-200">
          <AuditSummary />
        </div>
      )}
    </div>
  );
}
