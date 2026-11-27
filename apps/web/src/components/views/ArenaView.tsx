import { useState } from 'react'
import { Clock, Loader2, Play, Sparkles, Swords, Trophy, Zap } from 'lucide-react'
import { api } from '../../api/client'
import { useStudioStore } from '../../store/useStudioStore'
import type { ArenaComparisonResult } from '../../types/workflow'
import { MarkdownViewer } from '../common/MarkdownViewer'

export function ArenaView() {
  const workflows = useStudioStore((s) => s.workflows)
  const activeWorkflowId = useStudioStore((s) => s.activeWorkflowId)
  const selectWorkflow = useStudioStore((s) => s.selectWorkflow)
  const workflowName = useStudioStore((s) => s.workflowName)
  const nodes = useStudioStore((s) => s.nodes)
  const edges = useStudioStore((s) => s.edges)
  const runInputs = useStudioStore((s) => s.runInputs)
  const setRunInput = useStudioStore((s) => s.setRunInput)
  const fillSampleInputs = useStudioStore((s) => s.fillSampleInputs)
  const language = useStudioStore((s) => s.language)
  const showToast = useStudioStore((s) => s.showToast)

  const [modelA, setModelA] = useState('deepseek-chat')
  const [tempA, setTempA] = useState(0.2)
  const [suffixA, setSuffixA] = useState('')

  const [modelB, setModelB] = useState('gpt-4o-mini')
  const [tempB, setTempB] = useState(0.85)
  const [suffixB, setSuffixB] = useState(
    language === 'en'
      ? 'Executive perspective with quantified ROI and prioritized matrix'
      : '采用高管决策视角，强化量化 ROI 与优先级矩阵',
  )

  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ArenaComparisonResult | null>(null)

  const isEn = language === 'en'
  const inputNode = nodes.find((n) => n.type === 'input')
  const fields = inputNode?.data.fields || []

  const handleRunArena = async () => {
    if (!activeWorkflowId) return
    setRunning(true)
    try {
      const res = await api.arenaCompare({
        workflow_id: activeWorkflowId,
        inputs: runInputs,
        graph_override: { nodes, edges },
        language,
        variant_a: {
          label: isEn ? 'Variant A (Baseline)' : 'Variant A（严谨基线）',
          model: modelA,
          temperature: tempA,
          system_prompt_suffix: suffixA,
        },
        variant_b: {
          label: isEn ? 'Variant B (Challenger)' : 'Variant B（增强策略）',
          model: modelB,
          temperature: tempB,
          system_prompt_suffix: suffixB,
        },
      })
      setResult(res)
    } catch (err) {
      showToast((err as Error).message, 'error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-[#F5F7FB] dark:bg-[#090C12] p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Header with Workflow Picker */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Swords className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              <span>{isEn ? 'Workflow A/B Strategy Arena' : 'A/B 多策略竞技场对比评测'}</span>
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {isEn
                ? `Run "${workflowName}" in parallel across two model/prompt variants with 4-axis automated rubric scoring.`
                : `对「${workflowName}」并行执行两套模型 / Temperature / 提示词变体，自动进行 4 维质量打分与胜负裁决。`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeWorkflowId || ''}
              onChange={(e) => {
                setResult(null)
                selectWorkflow(e.target.value)
              }}
              className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#131926] px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-violet-500"
            >
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {isEn && w.name_en ? w.name_en : w.name}
                </option>
              ))}
            </select>
            <button
              onClick={fillSampleInputs}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#131926] hover:bg-slate-100 dark:hover:bg-white/10 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              <span>{isEn ? 'Fill Sample' : '填入示例'}</span>
            </button>
            <button
              onClick={handleRunArena}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 hover:brightness-110 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-violet-600/30 disabled:opacity-50"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
              <span>{running ? (isEn ? 'Running Dual DAG...' : '双路并行评测中...') : isEn ? 'Run A/B Duel' : '开始 A/B 并行对决'}</span>
            </button>
          </div>
        </div>

        {/* Inline Shared Input Parameters */}
        {fields.length > 0 && (
          <div className="rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#111724] p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              {isEn ? 'Shared Benchmark Input Payload' : '共同测试输入参数（A/B 双方使用同一份输入）'}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {fields.map((f) => (
                <div key={f.name}>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                    {isEn && f.labelEn ? f.labelEn : f.label}
                  </label>
                  <input
                    value={runInputs[f.name] || ''}
                    onChange={(e) => setRunInput(f.name, e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#090C12] px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-violet-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Variant Config Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[
            {
              title: isEn ? 'Variant A · Precise Baseline' : 'Variant A · 严谨低熵基线',
              accent: 'border-sky-500/35 from-sky-500/10',
              model: modelA,
              setModel: setModelA,
              temp: tempA,
              setTemp: setTempA,
              suffix: suffixA,
              setSuffix: setSuffixA,
            },
            {
              title: isEn ? 'Variant B · Prompt Challenger' : 'Variant B · 策略增强挑战者',
              accent: 'border-fuchsia-500/35 from-fuchsia-500/10',
              model: modelB,
              setModel: setModelB,
              temp: tempB,
              setTemp: setTempB,
              suffix: suffixB,
              setSuffix: setSuffixB,
            },
          ].map((v) => (
            <div
              key={v.title}
              className={`rounded-2xl border ${v.accent} bg-gradient-to-br via-transparent to-transparent bg-white dark:bg-[#111724] p-4 space-y-3`}
            >
              <div className="text-xs font-bold text-slate-900 dark:text-white">{v.title}</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] text-slate-500 dark:text-slate-400 mb-1">Model</label>
                  <input
                    value={v.model}
                    onChange={(e) => v.setModel(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#090C12] px-2.5 py-1.5 font-mono text-xs outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] text-slate-500 dark:text-slate-400 mb-1">Temperature ({v.temp})</label>
                  <input
                    type="range"
                    min={0}
                    max={1.4}
                    step={0.05}
                    value={v.temp}
                    onChange={(e) => v.setTemp(Number(e.target.value))}
                    className="w-full mt-2 accent-violet-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10.5px] text-slate-500 dark:text-slate-400 mb-1">
                  {isEn ? 'System Prompt Patch' : 'System Prompt 附加指令（Prompt Patch）'}
                </label>
                <input
                  value={v.suffix}
                  onChange={(e) => v.setSuffix(e.target.value)}
                  placeholder={isEn ? 'Leave blank to use original prompts' : '留空则使用原始画布 Prompt'}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#090C12] px-2.5 py-1.5 text-xs outline-none focus:border-violet-500"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Comparison Results */}
        {result && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-violet-500/10 to-transparent px-5 py-3.5">
              <div className="flex items-center gap-3">
                <Trophy className="h-6 w-6 text-amber-500 dark:text-amber-400" />
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {result.winner === 'TIE'
                      ? isEn ? 'Draw — Equal Rubric Score (TIE)' : '本轮对决势均力敌（TIE）'
                      : isEn ? `Winner: Variant ${result.winner}` : `综合评判胜出：Variant ${result.winner}`}
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                    Variant A: {result.variant_a.scores.overall_score} vs Variant B: {result.variant_b.scores.overall_score}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {[
                { key: 'A', data: result.variant_a, isWinner: result.winner === 'A', color: '#0EA5E9' },
                { key: 'B', data: result.variant_b, isWinner: result.winner === 'B', color: '#D946EF' },
              ].map(({ key, data, isWinner, color }) => (
                <div
                  key={key}
                  className={[
                    'overflow-hidden rounded-2xl border bg-white dark:bg-[#111724] shadow-xl flex flex-col',
                    isWinner ? 'border-amber-500/70 ring-1 ring-amber-400/30' : 'border-slate-200 dark:border-white/10',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.08] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{data.label}</span>
                      {isWinner && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          🏆 WINNER
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {data.duration_ms}ms
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Zap className="h-3 w-3 text-amber-500" /> {data.tokens} tok
                      </span>
                      <span className="font-bold text-base text-slate-900 dark:text-white">
                        {data.scores.overall_score}
                      </span>
                    </div>
                  </div>

                  {/* 4-Dimension Score Progress Bars */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-slate-200/70 dark:border-white/[0.06] bg-slate-50/80 dark:bg-[#0B0F17] px-4 py-3">
                    {[
                      { label: isEn ? 'Structure' : '结构排版', val: data.scores.structure_score },
                      { label: isEn ? 'Depth' : '内容深度', val: data.scores.depth_score },
                      { label: isEn ? 'Speed' : '响应速度', val: data.scores.speed_score },
                      { label: isEn ? 'Efficiency' : 'Token效率', val: data.scores.efficiency_score },
                    ].map((m) => (
                      <div key={m.label} className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500 dark:text-slate-400">{m.label}</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{m.val}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                          <div style={{ width: `${m.val}%`, backgroundColor: color }} className="h-full rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-5 max-h-[500px] overflow-y-auto">
                    <MarkdownViewer content={data.output} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
