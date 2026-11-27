import React from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface State {
  hasError: boolean
  errorMessage: string
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message || 'Unexpected UI error' }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-[#0D1117] p-6 text-slate-100">
          <div className="max-w-md rounded-2xl border border-rose-500/30 bg-[#141B26] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="h-6 w-6" />
              <h2 className="text-base font-bold">SynthFlow Studio Encountered an Error</h2>
            </div>
            <p className="rounded-lg bg-[#0D1117] p-3 font-mono text-xs text-rose-300 break-words">
              {this.state.errorMessage}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-semibold text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reload Studio</span>
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
