import {
  CheckCircle2,
  Clock,
  FileText,
  Image,
  ShieldCheck,
} from 'lucide-react';
import { useAutomation } from '../context/AutomationContext';

export function DocumentViewerPage() {
  const { execution } = useAutomation();

  const documents = [
    {
      name: 'Passport',
      type: 'Identity Document',
      icon: Image,
      status: 'Verified',
      statusColor: 'text-green-600 bg-green-50',
      expiry: '2028-11-30',
      verified: '2024-11-15',
    },
    {
      name: 'Utility Bill',
      type: 'Address Proof',
      icon: FileText,
      status: 'Verified',
      statusColor: 'text-green-600 bg-green-50',
      expiry: null,
      verified: '2024-11-20',
    },
    {
      name: 'Bank Statements',
      type: 'Source of Wealth',
      icon: FileText,
      status: 'Pending',
      statusColor: 'text-amber-600 bg-amber-50',
      expiry: null,
      verified: null,
    },
    {
      name: 'EDD Report',
      type: 'Enhanced Due Diligence',
      icon: ShieldCheck,
      status: 'Required',
      statusColor: 'text-red-600 bg-red-50',
      expiry: null,
      verified: null,
    },
  ];

  const isSelectingDisposition =
    execution.typingTarget === '#disposition-select';

  return (
    <div className="h-full bg-surface-50 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-surface-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-forge-100 rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-forge-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-surface-900">
              Document Verification
            </h1>
            <p className="text-xs text-surface-500">
              Marcus Chen · Case #4892
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {['Overview', 'Documents', 'Alerts', 'Transactions', 'Notes'].map((tab, i) => (
            <button
              key={tab}
              data-tab={tab.toLowerCase()}
              className={`nav-tab px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                i === 1
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
        {/* Documents Grid */}
        <div className="doc-verification grid grid-cols-2 gap-4">
          {documents.map((doc) => (
            <div key={doc.name} className="bg-white rounded-xl border border-surface-200 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <doc.icon className="w-4 h-4 text-surface-500" />
                  <div>
                    <h3 className="text-xs font-semibold text-surface-800">{doc.name}</h3>
                    <p className="text-[10px] text-surface-500">{doc.type}</p>
                  </div>
                </div>
                <span className={`passport-expiry inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${doc.statusColor}`}>
                  {doc.status === 'Verified' && <CheckCircle2 className="w-2.5 h-2.5" />}
                  {doc.status === 'Pending' && <Clock className="w-2.5 h-2.5" />}
                  {doc.status}
                </span>
              </div>

              {doc.status === 'Verified' && (
                <div className="text-xs space-y-1 text-surface-600">
                  <div className="flex justify-between">
                    <span>Verified</span>
                    <span className="font-mono">{doc.verified}</span>
                  </div>
                  {doc.expiry && (
                    <div className="flex justify-between">
                      <span>Expires</span>
                      <span className="font-mono">{doc.expiry}</span>
                    </div>
                  )}
                </div>
              )}

              {doc.status === 'Pending' && (
                <p className="text-xs text-amber-600">
                  Awaiting bank statements from client
                </p>
              )}

              {doc.status === 'Required' && (
                <p className="text-xs text-red-600">
                  EDD required due to PEP association
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Disposition */}
        <div className="bg-white rounded-xl border border-surface-200 p-4">
          <h2 className="text-sm font-semibold text-surface-800 mb-3">Case Disposition</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1.5">
                Disposition Action
              </label>
              <div
                id="disposition-select"
                className={`w-full px-3 py-2.5 border rounded-lg text-sm transition-all ${
                  isSelectingDisposition
                    ? 'border-forge-400 ring-2 ring-forge-100 bg-white'
                    : 'border-surface-300 bg-surface-50'
                }`}
              >
                {execution.stepStatuses[20] === 'passed' ? (
                  <span className="font-medium text-red-600">Escalate — SAR Filing Recommended</span>
                ) : isSelectingDisposition ? (
                  <span className="font-medium text-forge-600">
                    Escalate — SAR Filing Recommended
                  </span>
                ) : (
                  <span className="text-surface-400">Select disposition...</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
