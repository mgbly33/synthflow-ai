import { useState } from 'react'
import { Loader2, Sparkles, Wand2, X } from 'lucide-react'
import { api } from '../../api/client'
import { useStudioStore } from '../../store/useStudioStore'
import type { CopilotBlueprint, SynthNodeType } from '../../types/workflow'
import { NODE_ACCENT_META } from '../../utils/layout'

const SAMPLE_PROMPTS = [
  '搭建一个简历智能筛选、知识库匹配并包含人工审批门控的高级面试官出题工作流',
  '做一个 SaaS 大客户流失预警系统：抓取外部活跃 API 数据 + 根因诊断 + 挽留方案',
  '构建播客逐字稿拆解、多平台小红书/公众号批量宣发与结构化清洗流水线',
  '设计一个多专家智能意图分流客服中台，支持高优紧急与标准咨询双通道处理',
]

export function CopilotModal() {
  const isOpen = useStudioStore((s) => s.isCopilotOpen)
  const setOpen = useStudioStore((s) => s.setCopilotOpen)
  const language = useStudioStore((s) => s.language)
  const applyCopilotBlueprint = useStudioStore((s) => s.applyCopilotBlueprint)
  const showToast = useStudioStore((s) => s.showToast)

  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [blueprint, setBlueprint] = useState<CopilotBlueprint | null>(null)

  if (!isOpen) return null

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setBlueprint(null)
    try {
      const bp = await api.copilotGenerate({
        prompt: prompt.trim(),
        language,
        save_as_workflow: false,
      })
      setBlueprint(bp)
    } catch (err) {
      showToast((err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    if (!blueprint) return
    await applyCopilotBlueprint(blueprint)
    setOpen(false)
    setBlueprint(null)
    setPrompt('')
  }

  return (
    <div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-3xl border border-violet-500/35 bg-white dark:bg-[#101623] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 bg-gradient-to-r from-violet-600/20 via-indigo-500/10 to-cyan-500/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white shadow-lg shadow-violet-600/30">
              <Wand2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                SynthFlow AI 架构师 · 一句话生成可执行 DAG 工作流
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                描述任意业务场景，自动编排多智能体拓扑、RAG、API、意图路由与人工审批节点
              </p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：帮我搭建一个带知识库检索、外部行情 API 抓取和法务人工审批的自动化研报工作流..."
              className="w-full rounded-2xl border border-slate-200 dark:border-white/12 bg-slate-50 dark:bg-[#090C12] p-3.5 text-xs text-slate-900 dark:text-white outline-none focus:border-violet-500 resize-none leading-relaxed"
            />
          </div>

          {/* One-click Inspiration Chips */}
          <div className="space-y-1.5">
            <div className="text-[10.5px] font-semibold text-slate-400">推荐场景灵感（点击即填）</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {SAMPLE_PROMPTS.map((sp, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPrompt(sp)}
                  className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#151D2C] hover:border-violet-500/50 px-3 py-2 text-left text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 transition-colors"
                >
                  {sp}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 hover:brightness-110 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              <span>{loading ? 'AI 正在编排拓扑架构...' : '立即合成 DAG 蓝图'}</span>
            </button>
          </div>

          {/* Synthesized Blueprint Preview */}
          {blueprint && (
            <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.06] p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">{blueprint.name}</div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {blueprint.rationale}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-emerald-500/15 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-500">
                  {blueprint.graph_json.nodes.length}N · {blueprint.graph_json.edges.length}E
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {blueprint.graph_json.nodes.map((n) => {
                  const meta = NODE_ACCENT_META[(n.type || 'llm') as SynthNodeType] || NODE_ACCENT_META.llm
                  return (
                    <span
                      key={n.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10.5px] font-medium"
                      style={{
                        borderColor: `${meta.color}40`,
                        backgroundColor: `${meta.color}14`,
                        color: meta.color,
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                      {n.data.label || n.id}
                    </span>
                  )
                })}
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={handleApply}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/25"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>创建并载入画布立即运行</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
