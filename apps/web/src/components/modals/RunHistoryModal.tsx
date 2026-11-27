import { useState } from 'react'
import {
  Activity,
  CheckCircle2,
  Clock,
  ExternalLink,
  Film,
  History,
  SkipForward,
  Trash2,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStudioStore } from '../../store/useStudioStore'
import type { SynthNodeType } from '../../types/workflow'
import { NODE_ACCENT_META } from '../../utils/layout'
import { MarkdownViewer } from '../common/MarkdownViewer'

export function RunHistoryModal() {
  const { t } = useTranslation()
  const isOpen = useStudioStore((s) => s.isHistoryOpen)
  const setOpen = useStudioStore((s) => s.setHistoryOpen)
  const runs = useStudioStore((s) => s.runs)
  const selectedDetail = useStudioStore((s) => s.selectedRunDetail)
  const selectRunDetail = useStudioStore((s) => s.selectRunDetail)
  const deleteRun = useStudioStore((s) => s.deleteRun)
  const selectWorkflow = useStudioStore((s) => s.selectWorkflow)
  const startCanvasReplay = useStudioStore((s) => s.startCanvasReplay)

  const [selectedNodeLogId, setSelectedNodeLogId] = useState<string | null>(null)

  if (!isOpen) return null

  const activeNodeLog =
    selectedDetail?.node_logs.find((n) => n.id === selectedNodeLogId) ||
    selectedDetail?.node_logs[selectedDetail.node_logs.length - 1] ||
    null

  const totalSpan = Math.max(
    1,
    selectedDetail?.total_duration_ms || 1,
    ...(selectedDetail?.node_logs || []).map((l) => (l.offset_ms || 0) + (l.duration_ms || 1)),
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div className="flex h-[84vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-[#263348] bg-white dark:bg-[#111722] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222D40] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <History className="h-5 w-5 text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('traceTitle')}</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E293B]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Runs List */}
          <div className="w-72 shrink-0 overflow-y-auto border-r border-slate-200 dark:border-[#222D40] p-3 space-y-2 bg-slate-50/50 dark:bg-[#0E131D]">
            {runs.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400">{t('noRunsYet')}</p>
            ) : (
              runs.map((run) => {
                const active = selectedDetail?.id === run.id
                return (
                  <div
                    key={run.id}
                    onClick={() => {
                      setSelectedNodeLogId(null)
                      selectRunDetail(run.id)
                    }}
                    className={[
                      'group cursor-pointer rounded-xl border p-3 transition-all',
                      active
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-slate-200 dark:border-[#232F43] bg-white dark:bg-[#151D2B] hover:border-slate-300 dark:hover:border-slate-600',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {run.workflow_name || 'Workflow Run'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteRun(run.id)
                        }}
                        className="rounded p-0.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      <span
                        className={
                          run.status === 'COMPLETED'
                            ? 'text-emerald-500 font-semibold'
                            : run.status === 'FAILED'
                              ? 'text-rose-500 font-semibold'
                              : 'text-amber-500 font-semibold'
                        }
                      >
                        {run.status}
                      </span>
                      <span>{run.total_duration_ms}ms</span>
                      <span className="rounded bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.5">
                        {run.provider_mode}
                      </span>
                    </div>
                    <div className="mt-1.5 text-[10px] text-slate-400">
                      {new Date(run.started_at).toLocaleString()}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Right Trace Waterfall & Inspector */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {!selectedDetail ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                {t('noRunsYet')}
              </div>
            ) : (
              <>
                {/* Run Summary Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-[#243044] bg-slate-50/80 dark:bg-[#151D2B] p-3.5">
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedDetail.workflow_name}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-indigo-400" />
                        {selectedDetail.total_duration_ms} ms
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Zap className="h-3.5 w-3.5 text-amber-400" />
                        {selectedDetail.total_tokens} tokens
                      </span>
                      <span className="rounded bg-violet-500/15 px-2 py-0.5 text-violet-500 dark:text-violet-300">
                        {selectedDetail.provider_mode}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startCanvasReplay(selectedDetail)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-violet-600 hover:brightness-110 px-3 py-1.5 text-xs font-bold text-white shadow-md"
                    >
                      <Film className="h-3.5 w-3.5" />
                      <span>画布逐帧回放</span>
                    </button>
                    {selectedDetail.workflow_id && (
                      <button
                        onClick={() => {
                          selectWorkflow(selectedDetail.workflow_id!)
                          setOpen(false)
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>{t('restoreToCanvas')}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Waterfall Timeline */}
                <section className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <Activity className="h-4 w-4 text-violet-500" />
                    <span>{t('waterfallTimeline')}</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-[#243044] overflow-hidden divide-y divide-slate-200/70 dark:divide-[#1F293B]">
                    {selectedDetail.node_logs.map((log) => {
                      const nt = (log.node_type || 'llm') as SynthNodeType
                      const accent = NODE_ACCENT_META[nt] || NODE_ACCENT_META.llm
                      const leftPct = Math.min(96, ((log.offset_ms || 0) / totalSpan) * 100)
                      const widthPct = Math.max(
                        log.status === 'SKIPPED' ? 1.5 : 3,
                        Math.min(100 - leftPct, ((log.duration_ms || 10) / totalSpan) * 100),
                      )
                      const isPicked = activeNodeLog?.id === log.id

                      return (
                        <div
                          key={log.id}
                          onClick={() => setSelectedNodeLogId(log.id)}
                          className={[
                            'grid grid-cols-12 items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-colors',
                            isPicked
                              ? 'bg-violet-500/10'
                              : 'bg-white dark:bg-[#131A26] hover:bg-slate-50 dark:hover:bg-[#192233]',
                          ].join(' ')}
                        >
                          <div className="col-span-4 flex items-center gap-2 min-w-0">
                            {log.status === 'COMPLETED' && (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                            )}
                            {log.status === 'SKIPPED' && (
                              <SkipForward className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            )}
                            {log.status === 'FAILED' && (
                              <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                            )}
                            <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                              {log.node_label || log.node_id}
                            </span>
                          </div>

                          {/* Relative Waterfall Bar */}
                          <div className="col-span-6 relative h-5 rounded-md bg-slate-100 dark:bg-[#0D1117] overflow-hidden">
                            <div
                              style={{
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                                backgroundColor: log.status === 'SKIPPED' ? '#64748B' : accent.color,
                              }}
                              className="absolute top-1 bottom-1 rounded-sm opacity-90 transition-all"
                            />
                          </div>

                          <div className="col-span-2 text-right font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {log.status === 'SKIPPED' ? 'SKIP' : `${log.duration_ms}ms`}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>

                {/* Selected Node Trace Details */}
                {activeNodeLog && (
                  <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-200 dark:border-[#243044] bg-slate-50/70 dark:bg-[#0E131D] p-3.5">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {t('inputSnapshot')} — {activeNodeLog.node_label}
                      </div>
                      <pre className="max-h-72 overflow-auto font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                        {activeNodeLog.input_snapshot || '(Empty)'}
                      </pre>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-[#243044] bg-white dark:bg-[#131A26] p-3.5">
                      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <span>{t('outputDetail')}</span>
                        <span className="font-mono text-indigo-400">{activeNodeLog.tokens_used} tok</span>
                      </div>
                      <div className="max-h-72 overflow-y-auto pr-1">
                        {activeNodeLog.error_message ? (
                          <p className="font-mono text-xs text-rose-400">{activeNodeLog.error_message}</p>
                        ) : activeNodeLog.output_text ? (
                          <MarkdownViewer content={activeNodeLog.output_text} />
                        ) : (
                          <p className="text-xs text-slate-400">(No output / Skipped)</p>
                        )}
                      </div>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
