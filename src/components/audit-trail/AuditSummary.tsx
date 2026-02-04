import { format } from 'date-fns';
import { CheckCircle2, XCircle, Clock, BarChart3 } from 'lucide-react';
import { useAutomation } from '../../context/AutomationContext';

export function AuditSummary() {
  const { steps, execution } = useAutomation();

  if (execution.status !== 'completed') return null;

  const passed = execution.stepStatuses.filter((s) => s === 'passed').length;
  const failed = execution.stepStatuses.filter((s) => s === 'failed').length;
  const total = steps.length;
  const allPassed = failed === 0;
  const duration =
    execution.startTime && execution.endTime
      ? Math.round(
          (execution.endTime.getTime() - execution.startTime.getTime()) / 1000
        )
      : 0;

  return (
    <div className={`rounded-xl border-2 p-4 ${allPassed ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
      <div className="flex items-center gap-2 mb-3">
        {allPassed ? (
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        ) : (
          <XCircle className="w-5 h-5 text-red-600" />
        )}
        <span className={`text-sm font-bold ${allPassed ? 'text-green-700' : 'text-red-700'}`}>
          Runbook {allPassed ? 'PASSED' : 'FAILED'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-surface-500" />
          <div>
            <span className="text-surface-500">Steps</span>
            <p className="font-mono font-medium text-surface-800">
              {passed}/{total} passed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-surface-500" />
          <div>
            <span className="text-surface-500">Duration</span>
            <p className="font-mono font-medium text-surface-800">{duration}s</p>
          </div>
        </div>
        {execution.startTime && (
          <div className="col-span-2">
            <span className="text-surface-500">Completed</span>
            <p className="font-mono font-medium text-surface-800 text-[10px]">
              {format(execution.endTime!, 'yyyy-MM-dd HH:mm:ss')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
