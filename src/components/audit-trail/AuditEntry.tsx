import { format } from 'date-fns';
import type { AuditLogEntry } from '../../types/automation';
import { STEP_TYPE_META } from '../../constants/step-types';
import { SeverityBadge, StatusBadge } from '../shared/StatusBadge';
import { JsonViewer } from '../shared/JsonViewer';

interface AuditEntryProps {
  entry: AuditLogEntry;
}

export function AuditEntry({ entry }: AuditEntryProps) {
  const meta = STEP_TYPE_META[entry.type];
  const Icon = meta.icon;

  return (
    <div className="border-l-2 border-surface-200 pl-3 pb-4 relative group">
      {/* Timeline dot */}
      <div className={`absolute -left-[5px] top-0.5 w-2 h-2 rounded-full ${
        entry.status === 'passed' ? 'bg-success' :
        entry.status === 'failed' ? 'bg-danger' :
        entry.status === 'running' ? 'bg-forge-500' :
        'bg-surface-300'
      }`} />

      <div className="space-y-1.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Icon className={`w-3 h-3 flex-shrink-0 ${meta.color}`} />
            <span className="text-xs font-medium text-surface-800 truncate">
              {entry.label}
            </span>
          </div>
          <span className="text-[10px] text-surface-400 font-mono tabular-nums flex-shrink-0">
            {format(entry.timestamp, 'HH:mm:ss.SSS')}
          </span>
        </div>

        {/* Message & badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <SeverityBadge severity={entry.severity} />
          <StatusBadge status={entry.status} />
          {entry.duration !== undefined && (
            <span className="text-[10px] text-surface-400 font-mono">
              {entry.duration}ms
            </span>
          )}
        </div>

        <p className="text-[11px] text-surface-600 leading-relaxed">
          {entry.message}
        </p>

        {/* Screenshot */}
        {entry.screenshotUrl && (
          <div className="mt-1.5">
            <a
              href={entry.screenshotUrl}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg overflow-hidden border border-surface-200 bg-surface-50 hover:border-surface-300 transition-colors"
              title="Open screenshot in new tab"
            >
              <img
                src={entry.screenshotUrl}
                alt="Run screenshot"
                loading="lazy"
                className="w-full h-auto block"
              />
            </a>
            <div className="mt-1 flex items-center justify-between text-[10px] text-surface-500">
              <span>Screenshot</span>
              <a
                href={entry.screenshotUrl}
                target="_blank"
                rel="noreferrer"
                className="text-forge-700 hover:underline"
              >
                Open
              </a>
            </div>
          </div>
        )}

        {/* Extracted data */}
        {entry.extractedData && (
          <div className="mt-1.5">
            <div className="text-[10px] text-surface-500 mb-1 font-medium uppercase tracking-wider">
              Extracted Data
            </div>
            <JsonViewer data={entry.extractedData} />
          </div>
        )}
      </div>
    </div>
  );
}
