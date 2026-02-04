import { Monitor } from 'lucide-react';

export function MobileMessage() {
  return (
    <div className="md:hidden flex flex-col items-center justify-center h-screen p-8 bg-surface-50 text-center">
      <Monitor className="w-12 h-12 text-forge-500 mb-4" />
      <h1 className="text-lg font-bold text-surface-900 mb-2">Desktop Required</h1>
      <p className="text-sm text-surface-600 max-w-xs">
        The Runbook Visualizer requires a desktop browser for the full three-panel experience. Please open this page on a larger screen.
      </p>
    </div>
  );
}
