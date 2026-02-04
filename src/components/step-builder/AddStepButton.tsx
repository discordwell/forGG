import { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { nanoid } from 'nanoid';
import { STEP_TYPES_LIST } from '../../constants/step-types';
import { useAutomation, useAutomationDispatch } from '../../context/AutomationContext';

export function AddStepButton() {
  const { execution } = useAutomation();
  const dispatch = useAutomationDispatch();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isRunning = execution.status === 'running' || execution.status === 'paused';

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={isRunning}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-forge-600 bg-forge-50 hover:bg-forge-100 border border-dashed border-forge-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Step
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-surface-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
          {STEP_TYPES_LIST.map((meta) => {
            const Icon = meta.icon;
            return (
              <button
                key={meta.type}
                onClick={() => {
                  dispatch({
                    type: 'ADD_STEP',
                    step: {
                      id: nanoid(),
                      type: meta.type,
                      label: `New ${meta.label} step`,
                      targetCoords: { x: 400, y: 250 },
                    },
                  });
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-50 text-left transition-colors"
              >
                <div className={`flex items-center justify-center w-6 h-6 rounded-md ${meta.bgColor}`}>
                  <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                </div>
                <div>
                  <div className="text-xs font-medium text-surface-800">{meta.label}</div>
                  <div className="text-[10px] text-surface-500">{meta.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
