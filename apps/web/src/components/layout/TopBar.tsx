import React, { useRef } from 'react'
import {
  BarChart3,
  ClipboardCheck,
  Cpu,
  Download,
  GitCommitHorizontal,
  HelpCircle,
  History,
  Moon,
  Play,
  Redo2,
  Rocket,
  Save,
  Sparkles,
  Square,
  Sun,
  Swords,
  Undo2,
  Upload,
  Workflow as WorkflowIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStudioStore } from '../../store/useStudioStore'
import type { WorkflowGraph, WorkspaceView } from '../../types/workflow'

export function TopBar() {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const workspaceView = useStudioStore((s) => s.workspaceView)
  const setWorkspaceView = useStudioStore((s) => s.setWorkspaceView)
  const workflowName = useStudioStore((s) => s.workflowName)
  const setWorkflowName = useStudioStore((s) => s.setWorkflowName)
  const isDirty = useStudioStore((s) => s.isDirty)
  const isSaving = useStudioStore((s) => s.isSaving)
  const saveWorkflow = useStudioStore((s) => s.saveWorkflow)
  const undo = useStudioStore((s) => s.undo)
  const redo = useStudioStore((s) => s.redo)
  const canUndo = useStudioStore((s) => s.past.length > 0)
  const canRedo = useStudioStore((s) => s.future.length > 0)
  const nodes = useStudioStore((s) => s.nodes)
  const edges = useStudioStore((s) => s.edges)
  const importGraphJson = useStudioStore((s) => s.importGraphJson)
  const showToast = useStudioStore((s) => s.showToast)

  const providerConfig = useStudioStore((s) => s.providerConfig)
  const setSettingsOpen = useStudioStore((s) => s.setSettingsOpen)
  const setHistoryOpen = useStudioStore((s) => s.setHistoryOpen)
  const setVersionsOpen = useStudioStore((s) => s.setVersionsOpen)
  const setTourOpen = useStudioStore((s) => s.setTourOpen)

  const isRunning = useStudioStore((s) => s.isRunning)
  const startExecution = useStudioStore((s) => s.startExecution)
  const stopExecution = useStudioStore((s) => s.stopExecution)

  const theme = useStudioStore((s) => s.theme)
  const toggleTheme = useStudioStore((s) => s.toggleTheme)
  const language = useStudioStore((s) => s.language)
  const setLanguage = useStudioStore((s) => s.setLanguage)

  const isRealModel = providerConfig?.provider_mode === 'OPENAI_COMPAT'

  const handleExportJson = () => {
    const payload = {
      name: workflowName,
      exportedAt: new Date().toISOString(),
      graph_json: { nodes, edges },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(workflowName || 'synthflow-workflow').replace(/\s+/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast(language === 'en' ? 'Exported workflow JSON' : '已导出工作流 JSON', 'success')
  }

  const handleImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        const graph: WorkflowGraph = parsed.graph_json || parsed
        if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
          throw new Error('Invalid workflow graph schema')
        }
        importGraphJson(graph, parsed.name)
      } catch (err) {
        showToast(`JSON error: ${(err as Error).message}`, 'error')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const navItems: Array<{ id: WorkspaceView; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'studio', label: t('viewStudio'), icon: WorkflowIcon },
    { id: 'arena', label: t('viewArena'), icon: Swords },
    { id: 'evals', label: t('viewEvals'), icon: ClipboardCheck },
    { id: 'analytics', label: t('viewAnalytics'), icon: BarChart3 },
    { id: 'deploy', label: t('viewDeploy'), icon: Rocket },
  ]

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200/90 dark:border-white/[0.08] bg-white/95 dark:bg-[#0D121C]/95 px-3 backdrop-blur-xl z-30 overflow-hidden">
      {/* Left: Brand & Editable Workflow Title */}
      <div className="flex items-center gap-2 min-w-0 shrink">
        <div
          onClick={() => setWorkspaceView('studio')}
          className="flex items-center gap-2 shrink-0 cursor-pointer group"
        >
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 text-white shadow-lg shadow-violet-600/30">
            <WorkflowIcon className="h-4 w-4" />
          </div>
          <div className="hidden xl:block leading-none">
            <div className="text-[13.5px] font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1 whitespace-nowrap">
              <span>
                Synth<span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">Flow</span>
              </span>
              <span className="rounded bg-violet-500/15 px-1 py-0.5 text-[9px] font-mono font-bold text-violet-500 dark:text-violet-300">
                PRO
              </span>
            </div>
            <div className="hidden 2xl:block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{t('brandTagline')}</div>
          </div>
        </div>

        <div className="h-5 w-px bg-slate-200 dark:bg-white/10 shrink-0" />

        <div className="flex items-center gap-1.5 min-w-0">
          <input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            aria-label="Workflow name"
            className="w-24 lg:w-28 xl:w-32 2xl:w-48 truncate rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-white/10 focus:border-violet-500 bg-transparent px-1.5 py-1 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none transition-colors"
          />
          {isDirty && (
            <span
              title={t('unsaved')}
              className="inline-flex h-2 w-2 rounded-full bg-amber-500 shrink-0"
            />
          )}
        </div>
      </div>

      {/* Center: Top-Level Platform View Switcher */}
      <div
        data-tour="top-nav"
        className="flex items-center gap-0.5 rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-100/80 dark:bg-[#090C12] p-1 shrink-0"
      >
        {navItems.map((item) => {
          const Icon = item.icon
          const active = workspaceView === item.id
          return (
            <button
              key={item.id}
              onClick={() => setWorkspaceView(item.id)}
              className={[
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold whitespace-nowrap shrink-0 transition-all',
                active
                  ? 'bg-white dark:bg-[#172033] text-violet-600 dark:text-white shadow-sm border border-slate-200/70 dark:border-white/10'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-transparent',
              ].join(' ')}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden md:inline">{item.label}</span>
            </button>
          )
        })}
      </div>

      {/* Right: Studio Utilities, Provider, Versions, History, Save & Run */}
      <div data-tour="top-right-tools" className="flex items-center gap-1.5 shrink-0">
        {workspaceView === 'studio' && (
          <div className="hidden 2xl:flex items-center gap-0.5 mr-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              title={`${t('undo')} (Ctrl+Z)`}
              className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-30"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title={`${t('redo')} (Ctrl+Y)`}
              className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-30"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              title={t('importJson')}
              className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <Upload className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleExportJson}
              title={t('exportJson')}
              className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportChange} />
          </div>
        )}

        <button
          onClick={() => setSettingsOpen(true)}
          className={[
            'hidden xl:inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-all',
            isRealModel
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20'
              : 'border-violet-500/35 bg-violet-500/10 text-violet-600 dark:text-violet-300 hover:bg-violet-500/20',
          ].join(' ')}
        >
          {isRealModel ? <Cpu className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
          <span className="max-w-[105px] truncate">
            {isRealModel ? providerConfig?.default_model : t('demoEngine')}
          </span>
        </button>

        <button
          onClick={() => setVersionsOpen(true)}
          title={t('versions')}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141B29] px-2 py-1.5 text-xs font-medium whitespace-nowrap text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        >
          <GitCommitHorizontal className="h-3.5 w-3.5 text-cyan-500" />
          <span className="hidden 2xl:inline">{t('versions')}</span>
        </button>

        <button
          onClick={() => setHistoryOpen(true)}
          title={t('history')}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141B29] px-2 py-1.5 text-xs font-medium whitespace-nowrap text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        >
          <History className="h-3.5 w-3.5 text-indigo-400" />
          <span className="hidden 2xl:inline">{t('history')}</span>
        </button>

        <button
          onClick={saveWorkflow}
          disabled={isSaving}
          title={t('save')}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141B29] px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
        >
          <Save className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">{t('save')}</span>
        </button>

        {isRunning ? (
          <button
            onClick={stopExecution}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-xs font-bold whitespace-nowrap text-white shadow-lg shadow-rose-600/30 transition-all"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            <span>{t('stopRun')}</span>
          </button>
        ) : (
          <button
            data-tour="run-btn"
            onClick={() => {
              if (workspaceView !== 'studio') setWorkspaceView('studio')
              startExecution()
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 hover:brightness-110 px-3 py-1.5 text-xs font-bold whitespace-nowrap text-white shadow-lg shadow-violet-600/35 transition-all"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>{t('runWorkflow')}</span>
          </button>
        )}

        <button
          onClick={() => setTourOpen(true)}
          title={language === 'en' ? 'Interactive Guided Tour' : '打开新手引导'}
          className="rounded-xl border border-violet-500/35 bg-violet-500/10 hover:bg-violet-500/20 p-1.5 text-violet-600 dark:text-violet-300 transition-colors"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        <button
          onClick={toggleTheme}
          title="Toggle Theme"
          className="rounded-xl border border-slate-200 dark:border-white/10 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-600" />}
        </button>
        <button
          onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
          className="rounded-xl border border-slate-200 dark:border-white/10 px-2 py-1 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        >
          {language === 'zh' ? 'EN' : '中'}
        </button>
      </div>
    </header>
  )
}
