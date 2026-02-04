import type { StepStatus, Severity } from '../../types/automation';
import { CheckCircle2, XCircle, Clock, Loader2, MinusCircle } from 'lucide-react';

const STATUS_CONFIG: Record<StepStatus, { icon: typeof CheckCircle2; className: string; label: string }> = {
  pending: { icon: Clock, className: 'text-surface-400 bg-surface-100', label: 'Pending' },
  running: { icon: Loader2, className: 'text-forge-600 bg-forge-50 animate-spin', label: 'Running' },
  passed: { icon: CheckCircle2, className: 'text-success bg-green-50', label: 'Passed' },
  failed: { icon: XCircle, className: 'text-danger bg-red-50', label: 'Failed' },
  skipped: { icon: MinusCircle, className: 'text-surface-500 bg-surface-100', label: 'Skipped' },
};

const SEVERITY_CONFIG: Record<Severity, string> = {
  info: 'text-info bg-blue-50',
  success: 'text-success bg-green-50',
  warning: 'text-warning bg-yellow-50',
  error: 'text-danger bg-red-50',
};

export function StatusBadge({ status }: { status: StepStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${SEVERITY_CONFIG[severity]}`}>
      {severity}
    </span>
  );
}
