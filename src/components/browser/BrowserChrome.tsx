import { Globe, Lock, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { useAutomation } from '../../context/AutomationContext';
import { MOCK_PAGES } from '../../data/mock-pages';
import { BrowserViewport } from './BrowserViewport';

export function BrowserChrome() {
  const { execution } = useAutomation();
  const currentPageDef = MOCK_PAGES[execution.currentPage];
  const url = currentPageDef?.url || 'about:blank';
  const title = currentPageDef?.title || 'New Tab';

  return (
    <div className="flex-1 flex flex-col bg-surface-100 min-w-0 h-full">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-200 border-b border-surface-300">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[10px] text-surface-600 truncate max-w-xs">{title}</span>
        </div>
      </div>

      {/* Navigation bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-100 border-b border-surface-200">
        <div className="flex items-center gap-1">
          <button className="p-1 text-surface-400 hover:text-surface-600 rounded">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 text-surface-400 hover:text-surface-600 rounded">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 text-surface-400 hover:text-surface-600 rounded">
            <RotateCw className="w-3 h-3" />
          </button>
        </div>

        <div className="flex-1 flex items-center gap-1.5 bg-white border border-surface-200 rounded-full px-3 py-1">
          <Lock className="w-3 h-3 text-green-600 flex-shrink-0" />
          <span className="text-xs text-surface-700 truncate font-mono">{url}</span>
        </div>

        <Globe className="w-3.5 h-3.5 text-surface-400" />
      </div>

      {/* Viewport */}
      <BrowserViewport />
    </div>
  );
}
