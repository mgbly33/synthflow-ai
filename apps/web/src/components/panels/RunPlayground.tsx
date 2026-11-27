import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Loader2,
  Maximize2,
  Play,
  SkipForward,
  Sparkles,
  Square,
  Terminal,
  X,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStudioStore } from '../../store/useStudioStore'
import type { SynthNodeType } from '../../types/workflow'
import { NODE_ACCENT_META } from '../../utils/layout'
import { MarkdownViewer } from '../common/MarkdownViewer'

export function RunPlayground() {
  const { t } = useTranslation()
  const language = useStudioStore((s) => s.language)
  const nodes = useStudioStore((s) => s.nodes)
  const workflowName = useStudioStore((s) => s.workflowName)

  const runInputs = useStudioStore((s) => s.runInputs)
  const setRunInput = useStudioStore((s) => s.setRunInput)
  const fillSampleInputs = useStudioStore((s) => s.fillSampleInputs)

  const isRunning = useStudioStore((s) => s.isRunning)
  const startExecution = useStudioStore((s) => s.startExecution)
  const stopExecution = useStudioStore((s) => s.stopExecution)
  const nodeRuntime = useStudioStore((s) => s.nodeRuntime)
  const finalOutput = useStudioStore((s) => s.finalOutput)
  const lastRunStats = useStudioStore((s) => s.lastRunStats)
  const runError = useStudioStore((s) => s.runError)
  const pendingApproval = useStudioStore((s) => s.pendingApproval)
  const submitApprovalDecision = useStudioStore((s) => s.submitApprovalDecision)
  const isReaderOpen = useStudioStore((s) => s.isReaderOpen)
  const setReaderOpen = useStudioStore((s) => s.setReaderOpen)

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({})
  const [outputTab, setOutputTab] = useState<'rendered' | 'raw' | 'json'>('rendered')
  const [copiedMd, setCopiedMd] = useState(false)
  const [approvalDraft, setApprovalDraft] = useState<string | null>(null)

  useEffect(() => {
    setApprovalDraft(pendingApproval ? pendingApproval.pendingOutput : null)
  }, [pendingApproval?.runId, pendingApproval?.nodeId])

  const inputNode = nodes.find((n) => n.type === 'input')
  const fields = inputNode?.data.fields || []
  const hasSamples = Boolean(
    inputNode?.data.sampleInputs && Object.keys(inputNode.data.sampleInputs).length > 0,
  )

  const runtimeEntries = Object.entries(nodeRuntime).filter(([, st]) => st.status !== 'idle')
  const executableNodes = nodes.filter((n) => n.type !== 'note')
  const doneCount = executableNodes.filter((n) => {
    const st = nodeRuntime[n.id]?.status
    return st === 'completed' || st === 'skipped' || st === 'error'
  }).length
  const totalCount = Math.max(1, executableNodes.length)
  const progressPct = Math.min(100, Math.round((doneCount / totalCount) * 100))

  const toggleNodeExpand = (nid: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nid]: !prev[nid] }))
  }

  const handleCopyMarkdown = () => {
    if (!finalOutput) return
    navigator.clipboard.writeText(finalOutput)
    setCopiedMd(true)
    setTimeout(() => setCopiedMd(false), 1800)
  }

  const handleDownloadMd = () => {
    if (!finalOutput) return
    const blob = new Blob([finalOutput], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(workflowName || 'synthflow-report').replace(/\s+/g, '_')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Dynamic Input Form */}
        <section className="rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#131926] p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              {t('nodeTypes.input')}
            </span>
            {hasSamples && (
              <button
                type="button"
                onClick={fillSampleInputs}
                className="inline-flex items-center gap-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 px-2.5 py-1 text-[11px] font-semibold text-violet-600 dark:text-violet-300 transition-colors"
              >
                <Sparkles className="h-3 w-3" />
                <span>{t('fillSample')}</span>
              </button>
            )}
          </div>

          {fields.length === 0 ? (
            <p className="text-[11px] text-slate-400">
              {language === 'en' ? 'No input fields configured.' : '当前 Input 节点暂未定义字段，可直接运行。'}
            </p>
          ) : (
            <div className="space-y-2.5">
              {fields.map((f) => {
                const label = language === 'en' && f.labelEn ? f.labelEn : f.label
                return (
                  <div key={f.name}>
                    <label className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      <span>{label}</span>
                      <span className="font-mono text-[10px] text-slate-400">{`{{input.${f.name}}}`}</span>
                    </label>
                    {f.type === 'textarea' ? (
                      <textarea
                        rows={4}
                        value={runInputs[f.name] || ''}
                        onChange={(e) => setRunInput(f.name, e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#090C12] px-2.5 py-2 text-xs leading-relaxed text-slate-900 dark:text-slate-100 outline-none focus:border-violet-500 resize-y"
                      />
                    ) : (
                      <input
                        value={runInputs[f.name] || ''}
                        onChange={(e) => setRunInput(f.name, e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#090C12] px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-violet-500"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {isRunning ? (
            <button
              onClick={stopExecution}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-600/25 transition-all"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>{t('stopRun')}</span>
            </button>
          ) : (
            <button
              onClick={startExecution}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 hover:brightness-110 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30 transition-all"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{t('startRun')}</span>
            </button>
          )}

          {/* Live Execution Progress Bar */}
          {(isRunning || runtimeEntries.length > 0) && (
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[10.5px] font-mono text-slate-500 dark:text-slate-400">
                <span>
                  {isRunning ? t('runningStream') : 'Execution Complete'}
                </span>
                <span>
                  {doneCount}/{totalCount} ({progressPct}%)
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <div
                  style={{ width: `${progressPct}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400 transition-all duration-300"
                />
              </div>
            </div>
          )}
        </section>

        {/* Live Human-in-the-Loop (HITL) Approval Gate Banner */}
        {pendingApproval && (
          <section className="rounded-2xl border-2 border-amber-500/60 bg-amber-500/10 p-4 space-y-3 shadow-lg shadow-amber-500/10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-500 dark:text-amber-300">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping" />
                <span>人工审批暂停中 · {pendingApproval.nodeLabel}</span>
              </div>
              <span className="rounded-md bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-500">
                HITL GATE
              </span>
            </div>
            <p className="text-[11px] text-slate-700 dark:text-amber-100/90 leading-relaxed">
              {pendingApproval.instructions}
            </p>
            <div>
              <label className="mb-1 block text-[10.5px] font-semibold text-amber-600 dark:text-amber-300">
                在线审阅与改写上游输出（放行后将传递至下游节点）
              </label>
              <textarea
                rows={5}
                value={approvalDraft ?? pendingApproval.pendingOutput}
                onChange={(e) => setApprovalDraft(e.target.value)}
                className="w-full rounded-xl border border-amber-500/35 bg-white dark:bg-[#090C12] p-2.5 font-mono text-[11px] text-slate-800 dark:text-slate-100 outline-none focus:border-amber-400"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={async () => {
                  await submitApprovalDecision(false, undefined, 'Reviewer rejected in studio')
                  setApprovalDraft(null)
                }}
                className="rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 px-3.5 py-1.5 text-xs font-bold text-rose-500 dark:text-rose-300"
              >
                驳回并终止
              </button>
              <button
                onClick={async () => {
                  const edited = approvalDraft ?? pendingApproval.pendingOutput
                  await submitApprovalDecision(true, edited, 'Approved')
                  setApprovalDraft(null)
                }}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-600/25"
              >
                ✅ 批准放行并继续
              </button>
            </div>
          </section>
        )}

        {runError && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-500 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="break-words">{runError}</span>
          </div>
        )}

        {/* Live Node Stream */}
        {runtimeEntries.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Terminal className="h-3.5 w-3.5 text-violet-500" />
              <span>{t('liveExecutionLog')}</span>
            </div>

            <div className="space-y-1.5">
              {runtimeEntries.map(([nid, state]) => {
                const nt = (state.nodeType || 'llm') as SynthNodeType
                const accent = NODE_ACCENT_META[nt] || NODE_ACCENT_META.llm
                const isExpanded =
                  expandedNodes[nid] !== undefined
                    ? expandedNodes[nid]
                    : state.status === 'running' && (nt === 'llm' || nt === 'loop')

                return (
                  <div
                    key={nid}
                    className="overflow-hidden rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#121825]"
                  >
                    <button
                      type="button"
                      onClick={() => toggleNodeExpand(nid)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: accent.color }} />
                        <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                          {state.nodeLabel || nid}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono">
                        {state.tokensUsed ? <span className="text-slate-400">{state.tokensUsed} tok</span> : null}
                        {state.status === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />}
                        {state.status === 'completed' && (
                          <span className="inline-flex items-center gap-1 text-emerald-500">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {state.durationMs}ms
                          </span>
                        )}
                        {state.status === 'skipped' && (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <SkipForward className="h-3.5 w-3.5" />
                            SKIP
                          </span>
                        )}
                        {state.status === 'error' && <span className="text-rose-500">ERR</span>}
                      </div>
                    </button>

                    {isExpanded && (state.output || state.error) && (
                      <div className="border-t border-slate-200/70 dark:border-white/[0.07] bg-slate-50/70 dark:bg-[#090C12] p-3">
                        {state.error ? (
                          <p className="font-mono text-xs text-rose-400">{state.error}</p>
                        ) : nt === 'llm' || nt === 'output' || nt === 'knowledge' || nt === 'loop' || nt === 'code' ? (
                          <div className="max-h-64 overflow-y-auto pr-1">
                            <MarkdownViewer content={state.output} />
                            {state.status === 'running' && (
                              <span className="inline-block h-3.5 w-1.5 bg-violet-400 animate-pulse align-middle ml-1" />
                            )}
                          </div>
                        ) : (
                          <pre className="max-h-44 overflow-auto font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                            {state.output}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Final Rendered Output Card with Format Tabs + Fullscreen Reader */}
        {finalOutput && (
          <section className="overflow-hidden rounded-2xl border border-indigo-500/35 bg-white dark:bg-[#121825] shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-white/[0.08] bg-gradient-to-r from-violet-500/12 via-indigo-500/10 to-transparent px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">{t('finalReport')}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setReaderOpen(true)}
                  title={t('fullscreenRead')}
                  className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#182132] p-1.5 text-slate-600 dark:text-slate-300 hover:text-violet-400"
                >
                  <Maximize2 className="h-3 w-3" />
                </button>
                <button
                  onClick={handleCopyMarkdown}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#182132] px-2 py-1 text-[10.5px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  {copiedMd ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedMd ? t('copied') : t('copyMarkdown')}</span>
                </button>
                <button
                  onClick={handleDownloadMd}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#182132] px-2 py-1 text-[10.5px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  <Download className="h-3 w-3" />
                  <span>{t('downloadMd')}</span>
                </button>
              </div>
            </div>

            {/* Format View Switcher */}
            <div className="flex items-center gap-1 border-b border-slate-200/70 dark:border-white/[0.06] bg-slate-50/70 dark:bg-[#0C111B] px-3 py-1.5 text-[10.5px]">
              {(['rendered', 'raw', 'json'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setOutputTab(tab)}
                  className={[
                    'rounded-md px-2 py-0.5 font-mono uppercase transition-colors',
                    outputTab === tab
                      ? 'bg-indigo-500/20 text-indigo-500 dark:text-indigo-300 font-semibold'
                      : 'text-slate-400 hover:text-slate-200',
                  ].join(' ')}
                >
                  {tab === 'rendered' ? 'Markdown' : tab === 'raw' ? 'Raw MD' : 'Trace JSON'}
                </button>
              ))}
            </div>

            <div className="p-4 max-h-[420px] overflow-y-auto">
              {outputTab === 'rendered' && <MarkdownViewer content={finalOutput} />}
              {outputTab === 'raw' && (
                <pre className="font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                  {finalOutput}
                </pre>
              )}
              {outputTab === 'json' && (
                <pre className="font-mono text-[11px] text-cyan-600 dark:text-cyan-300 whitespace-pre-wrap">
                  {JSON.stringify({ stats: lastRunStats, nodes: nodeRuntime }, null, 2)}
                </pre>
              )}
            </div>

            {lastRunStats && (
              <div className="flex items-center justify-between border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-[#0B0F17] px-4 py-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-indigo-400" />
                  {t('totalDuration')}: <strong className="text-slate-800 dark:text-slate-100">{lastRunStats.durationMs} ms</strong>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  {t('totalTokens')}: <strong className="text-slate-800 dark:text-slate-100">{lastRunStats.totalTokens}</strong>
                </span>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Fullscreen Report Reader Modal */}
      {isReaderOpen && finalOutput && (
        <div
          onClick={() => setReaderOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0F1420] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 px-6 py-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{workflowName}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyMarkdown}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 px-3 py-1.5 text-xs font-medium"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>{t('copyMarkdown')}</span>
                </button>
                <button
                  onClick={handleDownloadMd}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{t('downloadMd')}</span>
                </button>
                <button onClick={() => setReaderOpen(false)} className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-10 py-8">
              <MarkdownViewer content={finalOutput} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
