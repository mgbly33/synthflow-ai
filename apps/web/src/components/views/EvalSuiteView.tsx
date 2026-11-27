import React, { useEffect, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  Play,
  Plus,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react'
import { api } from '../../api/client'
import { useStudioStore } from '../../store/useStudioStore'
import type { EvalAssertionRule, EvalCaseItem, EvalRunReport } from '../../types/workflow'
import { MarkdownViewer } from '../common/MarkdownViewer'

export function EvalSuiteView() {
  const workflows = useStudioStore((s) => s.workflows)
  const activeWorkflowId = useStudioStore((s) => s.activeWorkflowId)
  const selectWorkflow = useStudioStore((s) => s.selectWorkflow)
  const workflowName = useStudioStore((s) => s.workflowName)
  const nodes = useStudioStore((s) => s.nodes)
  const edges = useStudioStore((s) => s.edges)
  const runInputs = useStudioStore((s) => s.runInputs)
  const language = useStudioStore((s) => s.language)
  const showToast = useStudioStore((s) => s.showToast)

  const [cases, setCases] = useState<EvalCaseItem[]>([])
  const [report, setReport] = useState<EvalRunReport | null>(null)
  const [running, setRunning] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [expandedCase, setExpandedCase] = useState<Record<string, boolean>>({})

  const [newName, setNewName] = useState('')
  const [expectKeyword, setExpectKeyword] = useState('')
  const [expectNode, setExpectNode] = useState('')
  const [minLen, setMinLen] = useState('120')

  const isEn = language === 'en'

  const loadCases = async () => {
    if (!activeWorkflowId) return
    const list = await api.listEvalCases(activeWorkflowId)
    setCases(list)
  }

  useEffect(() => {
    setReport(null)
    loadCases()
  }, [activeWorkflowId])

  const handleAutoCreateBaseline = async () => {
    if (!activeWorkflowId) return
    const outNode = nodes.find((n) => n.type === 'output')
    const assertions: EvalAssertionRule[] = [
      { type: 'no_errors', value: '' },
      { type: 'min_length', value: '80' },
      { type: 'max_latency_ms', value: '15000' },
    ]
    if (outNode) assertions.push({ type: 'branch_taken', value: outNode.id })

    await api.createEvalCase({
      workflow_id: activeWorkflowId,
      name: isEn ? `Baseline Smoke Eval — ${workflowName}` : `${workflowName} · 基线冒烟回归用例`,
      inputs_json: { ...runInputs },
      assertions_json: assertions,
    })
    await loadCases()
    showToast(isEn ? 'Generated baseline eval case' : '已基于当前画布一键生成基线评测用例', 'success')
  }

  const handleAddCase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeWorkflowId || !newName.trim()) return
    const assertions: EvalAssertionRule[] = [{ type: 'no_errors', value: '' }]
    if (expectKeyword.trim()) assertions.push({ type: 'contains', value: expectKeyword.trim() })
    if (expectNode.trim()) assertions.push({ type: 'branch_taken', value: expectNode.trim() })
    if (minLen.trim()) assertions.push({ type: 'min_length', value: minLen.trim() })

    await api.createEvalCase({
      workflow_id: activeWorkflowId,
      name: newName.trim(),
      inputs_json: { ...runInputs },
      assertions_json: assertions,
    })
    setNewName('')
    setExpectKeyword('')
    setExpectNode('')
    setShowAdd(false)
    await loadCases()
    showToast(isEn ? 'Eval case added' : '已添加自动化回归评测用例', 'success')
  }

  const handleRunSuite = async () => {
    if (!activeWorkflowId) return
    setRunning(true)
    try {
      const rep = await api.runEvalSuite({
        workflow_id: activeWorkflowId,
        graph_override: { nodes, edges },
        language,
      })
      setReport(rep)
    } catch (err) {
      showToast((err as Error).message, 'error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-[#F5F7FB] dark:bg-[#090C12] p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <ClipboardCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              <span>{isEn ? 'Automated Regression Eval Studio' : '自动化断言回归评测集'}</span>
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {isEn
                ? `Run assertion datasets against "${workflowName}" to validate routing, latency, and output quality before deploying.`
                : `针对「${workflowName}」批量运行断言用例，校验关键词召回、路由分支命中（branch_taken）与响应延迟。`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeWorkflowId || ''}
              onChange={(e) => selectWorkflow(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#131926] px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
            >
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {isEn && w.name_en ? w.name_en : w.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAutoCreateBaseline}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isEn ? 'Auto Baseline' : '生成基线用例'}</span>
            </button>
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#131926] hover:bg-slate-100 dark:hover:bg-white/10 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              <Plus className="h-3.5 w-3.5 text-emerald-500" />
              <span>{isEn ? 'New Case' : '新增用例'}</span>
            </button>
            <button
              onClick={handleRunSuite}
              disabled={running || cases.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 disabled:opacity-45"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
              <span>
                {running
                  ? isEn ? 'Running Suite...' : '全量回归中...'
                  : isEn ? `Run All (${cases.length})` : `运行全部 (${cases.length})`}
              </span>
            </button>
          </div>
        </div>

        {/* Add Eval Case Form */}
        {showAdd && (
          <form
            onSubmit={handleAddCase}
            className="rounded-2xl border border-emerald-500/30 bg-white dark:bg-[#111724] p-4 space-y-3"
          >
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {isEn ? 'Create Assertion Case from Current Workflow Inputs' : '基于当前工作流输入快照创建新断言用例'}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={isEn ? 'Case name' : '用例名称（如：高风险分支校验）'}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#090C12] px-3 py-2 text-xs outline-none focus:border-emerald-500"
              />
              <input
                value={expectKeyword}
                onChange={(e) => setExpectKeyword(e.target.value)}
                placeholder="contains keyword"
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#090C12] px-3 py-2 text-xs outline-none focus:border-emerald-500"
              />
              <input
                value={expectNode}
                onChange={(e) => setExpectNode(e.target.value)}
                placeholder="branch_taken node_id"
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#090C12] px-3 py-2 font-mono text-xs outline-none focus:border-emerald-500"
              />
              <input
                value={minLen}
                onChange={(e) => setMinLen(e.target.value)}
                placeholder="min_length (120)"
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#090C12] px-3 py-2 font-mono text-xs outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs text-slate-500">
                Cancel
              </button>
              <button type="submit" className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 text-xs font-bold text-white">
                {isEn ? 'Save Case' : '保存用例'}
              </button>
            </div>
          </form>
        )}

        {/* Scorecard Summary */}
        {report && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4">
              <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                {isEn ? 'Regression Pass Rate' : '回归通过率 · Pass Rate'}
              </div>
              <div className="mt-2 text-3xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {report.pass_rate}%
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111724] p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">{isEn ? 'Passed / Total' : '通过用例 / 总用例'}</div>
              <div className="mt-2 text-3xl font-bold font-mono text-slate-900 dark:text-white">
                {report.passed_cases} / {report.total_cases}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111724] p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">{isEn ? 'Release Gate Verdict' : '发布门禁结论'}</div>
              <div className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                {report.pass_rate === 100
                  ? isEn ? '✅ All assertions green — Safe to deploy' : '✅ 全部断言通过，可安全发布生产'
                  : isEn ? '⚠️ Failing assertions detected' : '⚠️ 存在失败断言，请先排查提示词或路由规则'}
              </div>
            </div>
          </div>
        )}

        {/* Eval Cases List */}
        <div className="space-y-3">
          {cases.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/15 p-10 text-center space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEn
                  ? 'No eval cases attached to this workflow yet. Generate a baseline case in 1 click or switch to Contract Review / Intent Router templates.'
                  : '当前工作流暂无评测用例。可点击下方按钮 1 秒生成基线用例，或切换到「合同审查 / 竞品研报 / 意图路由」体验内置回归集！'}
              </p>
              <button
                onClick={handleAutoCreateBaseline}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isEn ? 'Auto-Generate Baseline Eval Case' : '一键生成基线评测用例'}</span>
              </button>
            </div>
          ) : (
            cases.map((c) => {
              const res = report?.results.find((r) => r.case_id === c.id)
              const isOpen = Boolean(expandedCase[c.id])
              return (
                <div
                  key={c.id}
                  className="rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#111724] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {res ? (
                        res.passed ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-rose-500 shrink-0" />
                        )
                      ) : (
                        <ClipboardCheck className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate text-sm font-bold text-slate-900 dark:text-white">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {res && (
                        <>
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {res.duration_ms}ms · {res.tokens} tok
                          </span>
                          <button
                            onClick={() => setExpandedCase((p) => ({ ...p, [c.id]: !p[c.id] }))}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                          >
                            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            <span>{isEn ? 'Output' : '输出预览'}</span>
                          </button>
                        </>
                      )}
                      <button
                        onClick={async () => {
                          await api.deleteEvalCase(c.id)
                          await loadCases()
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/15 hover:text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(res
                      ? res.assertions
                      : c.assertions_json.map((a) => ({
                          ...a,
                          passed: undefined,
                          detail: `${a.type}: ${a.value || 'ok'}`,
                        }))
                    ).map((a, idx) => (
                      <span
                        key={idx}
                        className={[
                          'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-mono text-[11px]',
                          a.passed === true
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : a.passed === false
                              ? 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#090C12] text-slate-600 dark:text-slate-300',
                        ].join(' ')}
                      >
                        {a.passed === true && <CheckCircle2 className="h-3 w-3" />}
                        {a.passed === false && <XCircle className="h-3 w-3" />}
                        <span>{a.detail}</span>
                      </span>
                    ))}
                  </div>

                  {res && isOpen && (
                    <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-[#090C12] p-3.5">
                      <MarkdownViewer content={res.output_preview} />
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
