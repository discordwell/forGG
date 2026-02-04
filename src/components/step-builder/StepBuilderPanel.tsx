import { ListChecks } from 'lucide-react';
import { useAutomation } from '../../context/AutomationContext';
import { StepCard } from './StepCard';
import { AddStepButton } from './AddStepButton';

export function StepBuilderPanel() {
  const { steps, execution } = useAutomation();

  const completedCount = execution.stepStatuses.filter((s) => s === 'passed').length;

  return (
    <div className="w-[280px] flex-shrink-0 bg-white border-r border-surface-200 flex flex-col h-full">
      <div className="px-4 py-3 border-b border-surface-200">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-forge-600" />
          <h2 className="text-sm font-semibold text-surface-800">Step Builder</h2>
        </div>
        <p className="text-[10px] text-surface-500 mt-0.5">
          {steps.length} steps · {completedCount} completed
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {steps.map((step, i) => (
          <StepCard key={step.id} step={step} index={i} />
        ))}
      </div>

      <div className="p-3 border-t border-surface-200">
        <AddStepButton />
      </div>
    </div>
  );
}
