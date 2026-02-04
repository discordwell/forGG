interface ProgressBarProps {
  current: number;
  total: number;
  className?: string;
}

export function ProgressBar({ current, total, className = '' }: ProgressBarProps) {
  const pct = total === 0 ? 0 : Math.round((current / total) * 100);
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-1.5 bg-surface-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-forge-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-surface-500 font-mono tabular-nums w-10 text-right">
        {pct}%
      </span>
    </div>
  );
}
