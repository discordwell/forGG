import {
  AlertTriangle,
  Clock,
  Shield,
  TrendingUp,
  Users,
  ChevronRight,
} from 'lucide-react';

export function DashboardPage() {
  const metrics = [
    { label: 'Pending Reviews', value: '23', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'High-Risk Alerts', value: '7', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Escalated Cases', value: '3', icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Avg. Resolution', value: '4.2h', icon: Shield, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  const cases = [
    { id: '4890', name: 'Elena Vostok', risk: 'Medium', type: 'PEP Screening', status: 'In Review', priority: false },
    { id: '4891', name: 'Rajan Patel', risk: 'Low', type: 'Periodic Review', status: 'Pending', priority: false },
    { id: '4892', name: 'Marcus Chen', risk: 'High', type: 'EDD — AML Alert', status: 'Urgent', priority: true },
    { id: '4893', name: 'Sofia Andersson', risk: 'Medium', type: 'Sanctions Update', status: 'In Review', priority: false },
    { id: '4894', name: 'James O\'Brien', risk: 'Low', type: 'Onboarding KYC', status: 'Pending', priority: false },
  ];

  return (
    <div className="h-full bg-surface-50 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-surface-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-surface-900 dashboard-header">
              Case Management Dashboard
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              <Users className="inline w-3 h-3 mr-1" />
              Compliance Team — Sarah Chen
            </p>
          </div>
          <div className="text-xs text-surface-500">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="metrics-panel grid grid-cols-4 gap-3 px-6 py-4">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white rounded-xl border border-surface-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg ${m.bg} flex items-center justify-center`}>
                <m.icon className={`w-4 h-4 ${m.color}`} />
              </div>
            </div>
            <div className="text-xl font-bold text-surface-900">{m.value}</div>
            <div className="text-[10px] text-surface-500 mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Case Queue */}
      <div className="px-6 pb-4">
        <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-surface-800">Active Case Queue</h2>
            <span className="text-[10px] text-surface-500">5 cases</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-50 text-left">
                <th className="px-4 py-2 font-medium text-surface-500">Case ID</th>
                <th className="px-4 py-2 font-medium text-surface-500">Customer</th>
                <th className="px-4 py-2 font-medium text-surface-500">Risk Level</th>
                <th className="px-4 py-2 font-medium text-surface-500">Type</th>
                <th className="px-4 py-2 font-medium text-surface-500">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {cases.map((c) => (
                <tr
                  key={c.id}
                  data-id={c.id}
                  className={`case-row hover:bg-surface-50 transition-colors ${c.priority ? 'bg-red-50/30' : ''}`}
                >
                  <td className="px-4 py-2.5 font-mono text-surface-600">#{c.id}</td>
                  <td className="px-4 py-2.5 font-medium text-surface-800">{c.name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      c.risk === 'High' ? 'bg-red-100 text-red-700' :
                      c.risk === 'Medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {c.risk}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-surface-600">{c.type}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      c.status === 'Urgent' ? 'bg-red-100 text-red-700' :
                      c.status === 'In Review' ? 'bg-blue-100 text-blue-700' :
                      'bg-surface-100 text-surface-600'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <ChevronRight className="w-3.5 h-3.5 text-surface-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
