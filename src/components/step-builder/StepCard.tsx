import { useState, useEffect } from 'react';
import { GripVertical, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { AutomationStep } from '../../types/automation';
import { STEP_TYPE_META } from '../../constants/step-types';
import { useAutomation, useAutomationDispatch } from '../../context/AutomationContext';
import { StatusBadge } from '../shared/StatusBadge';

interface StepCardProps {
  step: AutomationStep;
  index: number;
}

export function StepCard({ step, index }: StepCardProps) {
  const { execution } = useAutomation();
  const dispatch = useAutomationDispatch();
  const [expanded, setExpanded] = useState(false);

  const meta = STEP_TYPE_META[step.type];
  const Icon = meta.icon;
  const isActive = execution.currentStepIndex === index && execution.status !== 'idle';
  const isRunning = execution.status === 'running' || execution.status === 'paused';
  const status = execution.stepStatuses[index];

  useEffect(() => {
    if (isRunning) setExpanded(false);
  }, [isRunning]);

  return (
    <div
      className={`group relative rounded-lg border transition-all duration-200 ${
        isActive
          ? 'border-forge-400 bg-forge-50/50 animate-pulse-ring'
          : 'border-surface-200 bg-white hover:border-surface-300'
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <GripVertical className="w-3.5 h-3.5 text-surface-300 flex-shrink-0 cursor-grab" />

        <div className={`flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0 ${meta.bgColor}`}>
          <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-surface-400 tabular-nums">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="text-xs font-medium text-surface-800 truncate">
              {step.label}
            </span>
          </div>
        </div>

        <StatusBadge status={status} />

        <button
          onClick={() => !isRunning && setExpanded(!expanded)}
          disabled={isRunning}
          className="p-0.5 text-surface-400 hover:text-surface-600 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-surface-100">
          <div className="mt-2 space-y-2">
            <div>
              <label className="block text-[10px] font-medium text-surface-500 uppercase tracking-wider mb-1">
                Type
              </label>
              <select
                value={step.type}
                disabled={isRunning}
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_STEP',
                    id: step.id,
                    updates: { type: e.target.value as AutomationStep['type'] },
                  })
                }
                className="w-full text-xs border border-surface-200 rounded-md px-2 py-1.5 bg-white disabled:opacity-50"
              >
                {Object.values(STEP_TYPE_META).map((m) => (
                  <option key={m.type} value={m.type}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-surface-500 uppercase tracking-wider mb-1">
                Label
              </label>
              <input
                type="text"
                value={step.label}
                disabled={isRunning}
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_STEP',
                    id: step.id,
                    updates: { label: e.target.value },
                  })
                }
                className="w-full text-xs border border-surface-200 rounded-md px-2 py-1.5 disabled:opacity-50"
              />
            </div>

            {meta.hasTarget && (
              <div>
                <label className="block text-[10px] font-medium text-surface-500 uppercase tracking-wider mb-1">
                  Target
                </label>
                <input
                  type="text"
                  value={step.target || ''}
                  disabled={isRunning}
                  onChange={(e) =>
                    dispatch({
                      type: 'UPDATE_STEP',
                      id: step.id,
                      updates: { target: e.target.value },
                    })
                  }
                  className="w-full text-xs font-mono border border-surface-200 rounded-md px-2 py-1.5 disabled:opacity-50"
                  placeholder="CSS selector"
                />
              </div>
            )}

            {meta.hasValue && (
              <div>
                <label className="block text-[10px] font-medium text-surface-500 uppercase tracking-wider mb-1">
                  Value
                </label>
                <input
                  type="text"
                  value={step.value || ''}
                  disabled={isRunning}
                  onChange={(e) =>
                    dispatch({
                      type: 'UPDATE_STEP',
                      id: step.id,
                      updates: { value: e.target.value },
                    })
                  }
                  className="w-full text-xs border border-surface-200 rounded-md px-2 py-1.5 disabled:opacity-50"
                  placeholder="Value"
                />
              </div>
            )}

            <button
              onClick={() => dispatch({ type: 'REMOVE_STEP', id: step.id })}
              disabled={isRunning}
              className="flex items-center gap-1 text-xs text-danger hover:text-red-700 disabled:opacity-50 mt-1"
            >
              <Trash2 className="w-3 h-3" />
              Remove step
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
