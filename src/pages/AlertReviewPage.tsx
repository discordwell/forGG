import {
  AlertTriangle,
  ArrowUpRight,
  Globe2,
  TrendingUp,
} from 'lucide-react';

export function AlertReviewPage() {
  const transactions = [
    { date: 'Dec 18', from: 'Singapore', to: 'Cayman Islands', amount: '$450,000', type: 'Wire Transfer' },
    { date: 'Dec 17', from: 'Cayman Islands', to: 'Luxembourg', amount: '$380,000', type: 'Wire Transfer' },
    { date: 'Dec 15', from: 'Luxembourg', to: 'Singapore', amount: '$290,000', type: 'Wire Transfer' },
    { date: 'Dec 14', from: 'Singapore', to: 'Cayman Islands', amount: '$520,000', type: 'Wire Transfer' },
    { date: 'Dec 12', from: 'Cayman Islands', to: 'Luxembourg', amount: '$340,000', type: 'Wire Transfer' },
    { date: 'Dec 10', from: 'Luxembourg', to: 'Singapore', amount: '$360,000', type: 'Wire Transfer' },
  ];

  return (
    <div className="h-full bg-surface-50 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-surface-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-surface-900">
              AML Alert — AML-2024-8891
            </h1>
            <p className="text-xs text-surface-500">
              Marcus Chen · Unusual Transaction Pattern · Triggered Dec 18, 2024
            </p>
          </div>
          <div className="ml-auto">
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold uppercase">
              High Priority
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {['Overview', 'Documents', 'Alerts', 'Transactions', 'Notes'].map((tab, i) => (
            <button
              key={tab}
              data-tab={tab.toLowerCase()}
              className={`nav-tab px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                i === 2
                  ? 'bg-forge-100 text-forge-700'
                  : 'text-surface-500 hover:bg-surface-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Alert Summary */}
        <div className="alert-detail bg-white rounded-xl border border-surface-200 p-4">
          <h2 className="text-sm font-semibold text-surface-800 mb-3">Alert Summary</h2>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-surface-500">Alert Type</span>
              <p className="font-medium text-surface-800 mt-0.5">Unusual Transaction Pattern</p>
            </div>
            <div>
              <span className="text-surface-500">Total Flagged Amount</span>
              <p className="font-bold text-red-600 mt-0.5 text-sm">$2,340,000</p>
            </div>
            <div>
              <span className="text-surface-500">Flagged Transactions</span>
              <p className="font-medium text-surface-800 mt-0.5">14 transactions</p>
            </div>
            <div>
              <span className="text-surface-500">Rule Triggered</span>
              <p className="font-medium text-surface-800 mt-0.5">
                Rule 7.2 — Rapid fund movement across high-risk jurisdictions
              </p>
            </div>
            <div>
              <span className="text-surface-500">Jurisdictions Involved</span>
              <div className="flex gap-1 mt-1">
                {['Singapore', 'Cayman Islands', 'Luxembourg'].map((j) => (
                  <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-100 rounded text-[10px] font-medium text-surface-700">
                    <Globe2 className="w-2.5 h-2.5" /> {j}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-surface-500">Pattern Detected</span>
              <p className="font-medium text-amber-600 mt-0.5 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Round-tripping across 3 jurisdictions
              </p>
            </div>
          </div>
        </div>

        {/* Transaction Timeline */}
        <div className="transaction-timeline bg-white rounded-xl border border-surface-200 p-4">
          <h2 className="text-sm font-semibold text-surface-800 mb-3">
            Transaction Timeline
          </h2>
          <div className="space-y-2">
            {transactions.map((tx, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 bg-surface-50 rounded-lg text-xs">
                <span className="text-surface-500 w-12 flex-shrink-0 font-mono">{tx.date}</span>
                <span className="font-medium text-surface-700 w-28 flex-shrink-0">{tx.from}</span>
                <ArrowUpRight className="w-3 h-3 text-surface-400 flex-shrink-0" />
                <span className="font-medium text-surface-700 w-28 flex-shrink-0">{tx.to}</span>
                <span className="font-bold text-surface-900 flex-1 text-right">{tx.amount}</span>
                <span className="text-surface-500 w-20 text-right">{tx.type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
