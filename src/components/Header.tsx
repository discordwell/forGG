import { Workflow, Zap } from 'lucide-react';
import { useAutomation } from '../context/AutomationContext';
import { ProgressBar } from './shared/ProgressBar';
import { PlaybackControls } from './playback/PlaybackControls';
import { SCENARIO_NAME } from '../data/kyc-scenario';

export function Header() {
  const { steps, execution } = useAutomation();
  const completedCount = execution.stepStatuses.filter((s) => s === 'passed').length;

  return (
    <header className="bg-white border-b border-surface-200 px-4 py-2.5 flex items-center gap-4">
      {/* Brand */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="w-8 h-8 bg-forge-600 rounded-lg flex items-center justify-center">
          <Workflow className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-surface-900">Forge</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-forge-100 text-forge-700 rounded font-medium">
              Runbook
            </span>
          </div>
          <p className="text-[10px] text-surface-500 truncate max-w-xs">
            {SCENARIO_NAME}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex-1 max-w-md">
        <ProgressBar current={completedCount} total={steps.length} />
      </div>

      {/* Status */}
      {execution.status !== 'idle' && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Zap className={`w-3.5 h-3.5 ${
            execution.status === 'running' ? 'text-forge-500 animate-pulse' :
            execution.status === 'paused' ? 'text-amber-500' :
            execution.status === 'completed' ? 'text-green-500' :
            'text-surface-400'
          }`} />
          <span className="text-xs font-medium text-surface-600 capitalize">
            {execution.status}
          </span>
          <span className="text-[10px] text-surface-400 font-mono">
            Step {execution.currentStepIndex + 1}/{steps.length}
          </span>
        </div>
      )}

      {/* Playback */}
      <PlaybackControls />
    </header>
  );
}
