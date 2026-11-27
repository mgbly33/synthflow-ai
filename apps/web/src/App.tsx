import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { WorkflowCanvas } from './components/canvas/WorkflowCanvas'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { TopBar } from './components/layout/TopBar'
import { CommandPalette } from './components/modals/CommandPalette'
import { CopilotModal } from './components/modals/CopilotModal'
import { OnboardingTour } from './components/modals/OnboardingTour'
import { ProviderSettingsModal } from './components/modals/ProviderSettingsModal'
import { RunHistoryModal } from './components/modals/RunHistoryModal'
import { VersionsModal } from './components/modals/VersionsModal'
import { LeftSidebar } from './components/panels/LeftSidebar'
import { RightDrawer } from './components/panels/RightDrawer'
import { AnalyticsView } from './components/views/AnalyticsView'
import { ArenaView } from './components/views/ArenaView'
import { DeployApiView } from './components/views/DeployApiView'
import { EvalSuiteView } from './components/views/EvalSuiteView'
import { useStudioStore } from './store/useStudioStore'

function ToastBanner() {
  const toast = useStudioStore((s) => s.toast)
  if (!toast) return null

  const colorMap = {
    success: 'border-emerald-500/40 bg-emerald-950/95 text-emerald-200',
    error: 'border-rose-500/40 bg-rose-950/95 text-rose-200',
    info: 'border-violet-500/40 bg-[#111726]/95 text-slate-100',
  }

  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2">
      <div
        className={`rounded-xl border px-4 py-2 text-xs font-semibold shadow-2xl backdrop-blur-xl ${colorMap[toast.type]}`}
      >
        {toast.message}
      </div>
    </div>
  )
}

export default function App() {
  const initStudio = useStudioStore((s) => s.initStudio)
  const workspaceView = useStudioStore((s) => s.workspaceView)
  const leftCollapsed = useStudioStore((s) => s.leftCollapsed)
  const rightCollapsed = useStudioStore((s) => s.rightCollapsed)

  useEffect(() => {
    initStudio()
  }, [initStudio])

  return (
    <ErrorBoundary>
      <ReactFlowProvider>
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#F5F7FB] dark:bg-[#090C12]">
          <TopBar />

          {workspaceView === 'studio' && (
            <div className="flex flex-1 overflow-hidden">
              {!leftCollapsed && <LeftSidebar />}
              <main className="relative flex-1 overflow-hidden">
                <WorkflowCanvas />
              </main>
              {!rightCollapsed && <RightDrawer />}
            </div>
          )}

          {workspaceView === 'arena' && (
            <main className="flex-1 overflow-hidden">
              <ArenaView />
            </main>
          )}

          {workspaceView === 'evals' && (
            <main className="flex-1 overflow-hidden">
              <EvalSuiteView />
            </main>
          )}

          {workspaceView === 'analytics' && (
            <main className="flex-1 overflow-hidden">
              <AnalyticsView />
            </main>
          )}

          {workspaceView === 'deploy' && (
            <main className="flex-1 overflow-hidden">
              <DeployApiView />
            </main>
          )}

          <RunHistoryModal />
          <ProviderSettingsModal />
          <VersionsModal />
          <CommandPalette />
          <CopilotModal />
          <OnboardingTour />
          <ToastBanner />
        </div>
      </ReactFlowProvider>
    </ErrorBoundary>
  )
}
