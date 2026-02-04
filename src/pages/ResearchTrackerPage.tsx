import { Table, FileSpreadsheet } from 'lucide-react';
import { useAutomation } from '../context/AutomationContext';

export function ResearchTrackerPage() {
  const { execution } = useAutomation();
  const isTypingNotes = execution.typingTarget === '#tracker-notes';
  const isSelectingStatus = execution.typingTarget === '#tracker-status';
  const notesDone = execution.stepStatuses[19] === 'passed';
  const statusDone = execution.stepStatuses[20] === 'passed';

  const rows = [
    {
      name: 'Auberge Sato',
      site: 'Wix',
      booking: '¥22,000',
      agoda: '¥21,500',
      rating: '8.4',
      status: 'Contacted',
      statusColor: 'bg-blue-100 text-blue-700',
    },
    {
      name: 'Ougiura Lodge',
      site: 'Wix',
      booking: '¥12,000',
      agoda: '¥11,800',
      rating: '7.9',
      status: 'Pitched',
      statusColor: 'bg-purple-100 text-purple-700',
    },
    {
      name: 'Sea Glass Inn',
      site: 'Wix',
      booking: '¥16,800',
      agoda: '¥15,900',
      rating: '8.7',
      status: statusDone ? 'Ready to Pitch' : '—',
      statusColor: statusDone ? 'bg-amber-100 text-amber-700' : 'bg-surface-100 text-surface-500',
      isActive: true,
    },
    {
      name: 'Pension Cosmic',
      site: 'HTML',
      booking: '¥9,500',
      agoda: 'N/A',
      rating: '7.2',
      status: 'Skipped',
      statusColor: 'bg-surface-100 text-surface-500',
    },
  ];

  return (
    <div className="h-full bg-surface-50 overflow-auto">
      {/* Google Sheets header */}
      <div className="bg-white border-b border-surface-200 px-4 py-2 flex items-center gap-3">
        <FileSpreadsheet className="w-6 h-6 text-green-600" />
        <div>
          <h1 className="text-sm font-medium text-surface-800">Chichijima Accommodation Research</h1>
          <div className="flex items-center gap-3 text-[10px] text-surface-500">
            <span>File</span>
            <span>Edit</span>
            <span>View</span>
            <span>Insert</span>
            <span>Format</span>
            <span>Data</span>
            <span>Tools</span>
          </div>
        </div>
      </div>

      {/* Sheet tabs */}
      <div className="bg-surface-100 border-b border-surface-200 px-4 py-1 flex items-center gap-1">
        <div className="flex items-center gap-0.5">
          <span className="px-3 py-1 bg-white border border-surface-200 border-b-white rounded-t text-[10px] font-medium text-surface-700 -mb-px">
            <Table className="w-3 h-3 inline mr-1" />
            Competitors
          </span>
          <span className="px-3 py-1 text-[10px] text-surface-500 hover:bg-surface-200 rounded-t cursor-pointer">
            OTA Pricing
          </span>
          <span className="px-3 py-1 text-[10px] text-surface-500 hover:bg-surface-200 rounded-t cursor-pointer">
            Pitch Tracker
          </span>
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="p-4">
        <div className="bg-white border border-surface-200 rounded-lg overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[180px_60px_90px_90px_55px_100px] bg-surface-50 border-b border-surface-200 text-[10px] font-bold text-surface-600 uppercase tracking-wider">
            <div className="px-3 py-2 border-r border-surface-200">Property</div>
            <div className="px-3 py-2 border-r border-surface-200">Site</div>
            <div className="px-3 py-2 border-r border-surface-200">Booking</div>
            <div className="px-3 py-2 border-r border-surface-200">Agoda</div>
            <div className="px-3 py-2 border-r border-surface-200">Rating</div>
            <div className="px-3 py-2">Status</div>
          </div>

          {/* Data rows */}
          {rows.map((row) => (
            <div
              key={row.name}
              className={`grid grid-cols-[180px_60px_90px_90px_55px_100px] text-xs border-b border-surface-100 ${
                row.isActive ? 'bg-forge-50/30' : ''
              }`}
            >
              <div className="px-3 py-2.5 border-r border-surface-100 font-medium text-surface-800">
                {row.name}
              </div>
              <div className="px-3 py-2.5 border-r border-surface-100 text-surface-600">{row.site}</div>
              <div className="px-3 py-2.5 border-r border-surface-100 font-mono text-surface-700">{row.booking}</div>
              <div className="px-3 py-2.5 border-r border-surface-100 font-mono text-surface-700">{row.agoda}</div>
              <div className="px-3 py-2.5 border-r border-surface-100 font-mono text-surface-700">{row.rating}</div>
              <div className="px-3 py-2.5">
                {row.isActive ? (
                  <div
                    id="tracker-status"
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isSelectingStatus ? 'ring-2 ring-forge-300 ' : ''
                    }${row.statusColor}`}
                  >
                    {row.status}
                  </div>
                ) : (
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${row.statusColor}`}>
                    {row.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Notes row for active entry */}
        <div className="mt-3 bg-white border border-surface-200 rounded-lg p-3">
          <label className="block text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1.5">
            Notes — Sea Glass Inn
          </label>
          <div
            id="tracker-notes"
            className={`w-full px-3 py-2 border rounded-lg text-xs bg-surface-50 transition-all min-h-[36px] ${
              isTypingNotes
                ? 'border-forge-400 ring-2 ring-forge-100'
                : 'border-surface-200'
            }`}
          >
            {isTypingNotes ? (
              <span>
                {execution.typingText}
                <span className="inline-block w-0.5 h-3.5 bg-forge-600 animate-pulse ml-px align-middle" />
              </span>
            ) : notesDone ? (
              <span className="text-surface-800">
                Strong English site. OTA parity OK. Wix — candidate for pitch.
              </span>
            ) : (
              <span className="text-surface-400">Add notes...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
