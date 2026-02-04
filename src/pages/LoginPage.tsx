import { Shield } from 'lucide-react';
import { useAutomation } from '../context/AutomationContext';

export function LoginPage() {
  const { execution } = useAutomation();
  const isTypingUsername =
    execution.typingTarget === '#username';
  const isTypingPassword =
    execution.typingTarget === '#password';

  return (
    <div className="h-full bg-gradient-to-br from-slate-900 via-slate-800 to-forge-900 flex items-center justify-center">
      <div className="w-[380px] bg-white rounded-2xl shadow-2xl p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-forge-600 rounded-xl flex items-center justify-center mb-3">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-bold text-surface-900">AcmeCorp Comply</h1>
          <p className="text-xs text-surface-500 mt-0.5">Financial Compliance Platform</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-surface-600 mb-1.5">Email</label>
            <div
              id="username"
              className={`w-full px-3 py-2.5 border rounded-lg text-sm bg-surface-50 transition-all ${
                isTypingUsername
                  ? 'border-forge-400 ring-2 ring-forge-100'
                  : 'border-surface-300'
              }`}
            >
              {isTypingUsername ? (
                <span>
                  {execution.typingText}
                  <span className="inline-block w-0.5 h-4 bg-forge-600 animate-pulse ml-px align-middle" />
                </span>
              ) : execution.stepStatuses[1] === 'passed' ? (
                <span className="text-surface-800">sarah.chen@acmecorp.io</span>
              ) : (
                <span className="text-surface-400">Enter your email</span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-600 mb-1.5">Password</label>
            <div
              id="password"
              className={`w-full px-3 py-2.5 border rounded-lg text-sm bg-surface-50 transition-all ${
                isTypingPassword
                  ? 'border-forge-400 ring-2 ring-forge-100'
                  : 'border-surface-300'
              }`}
            >
              {isTypingPassword ? (
                <span>
                  {execution.typingText}
                  <span className="inline-block w-0.5 h-4 bg-forge-600 animate-pulse ml-px align-middle" />
                </span>
              ) : execution.stepStatuses[2] === 'passed' ? (
                <span className="text-surface-800">••••••••••••</span>
              ) : (
                <span className="text-surface-400">Enter your password</span>
              )}
            </div>
          </div>

          <button className="w-full py-2.5 bg-forge-600 hover:bg-forge-700 text-white text-sm font-medium rounded-lg transition-colors">
            Sign In
          </button>

          <div className="flex items-center justify-between text-xs text-surface-500">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" className="rounded border-surface-300" />
              Remember me
            </label>
            <span className="hover:text-forge-600 cursor-pointer">Forgot password?</span>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-surface-100 text-center">
          <p className="text-[10px] text-surface-400">
            Protected by AcmeCorp Security · SOC 2 Type II Certified
          </p>
        </div>
      </div>
    </div>
  );
}
