import {
  AlertTriangle,
  FileText,
  Globe2,
  ShieldAlert,
  User,
} from 'lucide-react';

export function CustomerProfilePage() {
  return (
    <div className="h-full bg-surface-50 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-surface-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-forge-100 flex items-center justify-center">
            <User className="w-5 h-5 text-forge-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-bold text-surface-900 profile-header">
              Marcus Wei Chen
            </h1>
            <p className="text-xs text-surface-500">
              Case #4892 · Private Banking · Singapore
            </p>
          </div>
          <div className="risk-score flex flex-col items-center px-4 py-2 bg-red-50 rounded-xl border border-red-200">
            <span className="text-2xl font-bold text-red-600">82</span>
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">High Risk</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {['Overview', 'Documents', 'Alerts', 'Transactions', 'Notes'].map((tab, i) => (
            <button
              key={tab}
              data-tab={tab.toLowerCase()}
              className={`nav-tab px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                i === 0
                  ? 'bg-forge-100 text-forge-700'
                  : 'text-surface-500 hover:bg-surface-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 p-6">
        {/* KYC Details */}
        <div className="kyc-details bg-white rounded-xl border border-surface-200 p-4 col-span-2">
          <h2 className="text-sm font-semibold text-surface-800 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-forge-600" />
            KYC Profile Summary
          </h2>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-surface-500">Full Name</span>
              <p className="font-medium text-surface-800 mt-0.5">Marcus Wei Chen</p>
            </div>
            <div>
              <span className="text-surface-500">Date of Birth</span>
              <p className="font-medium text-surface-800 mt-0.5">1985-03-14</p>
            </div>
            <div>
              <span className="text-surface-500">Nationality</span>
              <p className="font-medium text-surface-800 mt-0.5 flex items-center gap-1">
                <Globe2 className="w-3 h-3" /> Singapore
              </p>
            </div>
            <div>
              <span className="text-surface-500">Account Type</span>
              <p className="font-medium text-surface-800 mt-0.5">Private Banking</p>
            </div>
            <div>
              <span className="text-surface-500">Customer Since</span>
              <p className="font-medium text-surface-800 mt-0.5">June 22, 2019</p>
            </div>
            <div>
              <span className="text-surface-500">Relationship Manager</span>
              <p className="font-medium text-surface-800 mt-0.5">David Loh</p>
            </div>
          </div>
        </div>

        {/* PEP Status */}
        <div className="bg-white rounded-xl border border-amber-200 p-4">
          <h2 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            PEP Status
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-surface-500">Classification</span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase">
                Associated
              </span>
            </div>
            <div>
              <span className="text-surface-500">Relationship</span>
              <p className="font-medium text-surface-800 mt-0.5">
                Father — Chen Wei Ming, former Member of Parliament (Singapore)
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-surface-500">Last Screened</span>
              <span className="font-medium text-surface-800">2024-12-15</span>
            </div>
          </div>
        </div>

        {/* Sanctions Screening */}
        <div className="bg-white rounded-xl border border-green-200 p-4">
          <h2 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Sanctions Screening
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-surface-500">OFAC</span>
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase">
                Clear
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-surface-500">EU Sanctions</span>
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase">
                Clear
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-surface-500">UN Sanctions</span>
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase">
                Clear
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-surface-500">Last Screened</span>
              <span className="font-medium text-surface-800">2024-12-18</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
