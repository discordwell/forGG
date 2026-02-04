import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Gauge,
} from 'lucide-react';
import { useAutomation, useAutomationDispatch } from '../../context/AutomationContext';

const SPEEDS = [0.5, 1, 2, 4];

export function PlaybackControls() {
  const { execution } = useAutomation();
  const dispatch = useAutomationDispatch();

  const isIdle = execution.status === 'idle' || execution.status === 'completed';
  const isRunning = execution.status === 'running';
  const isPaused = execution.status === 'paused';

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-surface-900 rounded-xl">
      {/* Play/Pause */}
      {isIdle ? (
        <button
          onClick={() => dispatch({ type: 'START_EXECUTION' })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-forge-600 hover:bg-forge-700 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          Execute
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <button
            onClick={() =>
              dispatch({
                type: isRunning ? 'PAUSE_EXECUTION' : 'RESUME_EXECUTION',
              })
            }
            className="p-1.5 text-white hover:text-forge-300 transition-colors"
            title={isRunning ? 'Pause' : 'Resume'}
          >
            {isRunning ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => dispatch({ type: 'STOP_EXECUTION' })}
            className="p-1.5 text-white hover:text-red-400 transition-colors"
            title="Stop"
          >
            <Square className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step controls */}
      <div className="flex items-center gap-0.5 border-l border-surface-700 pl-3">
        <button
          onClick={() => dispatch({ type: 'STEP_BACK' })}
          disabled={isIdle}
          className="p-1.5 text-surface-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Step Back"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            if (isPaused) {
              dispatch({ type: 'STEP_FORWARD' });
            }
          }}
          disabled={isIdle || isRunning}
          className="p-1.5 text-surface-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Step Forward"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Speed control */}
      <div className="flex items-center gap-1.5 border-l border-surface-700 pl-3">
        <Gauge className="w-3.5 h-3.5 text-surface-400" />
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => dispatch({ type: 'SET_SPEED', speed: s })}
            className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
              execution.speed === s
                ? 'bg-forge-600 text-white'
                : 'text-surface-400 hover:text-white'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
