import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Play,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react'
import { useStudioStore } from '../../store/useStudioStore'

interface TourStep {
  id: string
  targetSelector: string
  titleZh: string
  titleEn: string
  bodyZh: string
  bodyEn: string
  tipZh: string
  tipEn: string
  actionLabelZh?: string
  actionLabelEn?: string
  actionKind?: 'run' | 'copilot' | 'hitl'
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'templates',
    targetSelector: '[data-tour="left-sidebar"]',
    titleZh: '① 模板库、12 种节点与企业知识库',
    titleEn: '1. Templates, 12 Node Types & RAG KB',
    bodyZh:
      '这里内置了 9 套开箱即用的商业工作流（竞品研报、营销工坊、合同风控、HITL 人工审批等）。切换上方标签还可以拖拽 12 种功能节点，或上传 .md/.txt 文档测试 BM25 知识检索。',
    bodyEn:
      'Explore 9 turnkey commercial workflows, switch tabs to drag 12 functional node types onto the canvas, or upload .md/.txt docs to test live BM25 RAG retrieval.',
    tipZh: '推荐试试列表最底部的「HITL 人工审批门控流」',
    tipEn: 'Try the "Human-in-the-Loop Approval" template at the bottom',
    actionLabelZh: '切换体验 HITL 模板',
    actionLabelEn: 'Load HITL Template',
    actionKind: 'hitl',
  },
  {
    id: 'canvas',
    targetSelector: '[data-tour="canvas-area"]',
    titleZh: '② 可视化 DAG 编排画布 & 数据血缘',
    titleEn: '2. Visual DAG Canvas & Data Lineage',
    bodyZh:
      '点击任意节点即可高亮它的上游来源与下游影响链；悬停节点上方会出现快捷栏，支持「⚡ 单节点试跑」、复制与删除。右键画布空白处也能快捷插节点，按 Ctrl+K 可呼出全局命令面板。',
    bodyEn:
      'Click any node to highlight its upstream & downstream data lineage. Hover a node for quick actions (Single-Node Test, Duplicate, Delete) or press Ctrl+K for the Command Palette.',
    tipZh: '连线悬停可点击 × 秒断，拖动支持 Ctrl+Z 撤销',
    tipEn: 'Hover any wire to disconnect; drag moves support Ctrl+Z undo',
  },
  {
    id: 'copilot',
    targetSelector: '[data-tour="copilot-btn"]',
    titleZh: '③ AI 架构师：一句话自动生成工作流',
    titleEn: '3. AI Architect: Text-to-DAG Copilot',
    bodyZh:
      '不想自己慢慢连线？点这里输入你的业务目标（例如“简历筛选+人工审批面试流”），AI 会自动设计节点拓扑、写好提示词与示例输入，一键载入就能直接跑！',
    bodyEn:
      'Describe any business goal in plain language and SynthFlow AI Architect synthesizes a complete, validated multi-branch DAG with prompts and sample inputs in one click.',
    tipZh: '旁边还有「AI 架构优化」和「Mermaid」一键导图',
    tipEn: 'Also try "AI Optimize" and "Mermaid" diagram export right beside it',
    actionLabelZh: '打开 AI 架构师试试',
    actionLabelEn: 'Open AI Architect',
    actionKind: 'copilot',
  },
  {
    id: 'run',
    targetSelector: '[data-tour="run-btn"]',
    titleZh: '④ 免 Key 一键流式运行工作流',
    titleEn: '4. Zero-Key Live SSE Streaming Run',
    bodyZh:
      '无需配置任何 API Key，点击这个按钮即可立即运行！画布节点会按拓扑顺序亮起呼吸光环，连线浮现流动光点，右侧同步逐字推流生成高管级 Markdown 报告。',
    bodyEn:
      'No API key needed to start! Click Run to watch nodes light up in parallel topological waves with glowing edges while streaming a formatted Markdown report in real time.',
    tipZh: '运行中途可随时点击「停止运行」优雅中止',
    tipEn: 'You can gracefully abort mid-stream at any time',
    actionLabelZh: '▶ 立刻帮我跑一遍',
    actionLabelEn: '▶ Run Demo Now',
    actionKind: 'run',
  },
  {
    id: 'playground',
    targetSelector: '[data-tour="right-drawer"]',
    titleZh: '⑤ 流式演练场 & 节点精调面板',
    titleEn: '5. Live Playground & Node Inspector',
    bodyZh:
      '右侧双模式切换：「流式运行」自动根据输入节点生成表单与结果报告（支持全屏阅读、Raw MD、Trace JSON、导出 .md）；「节点配置」支持一键插入上游变量芯片与 CO-STAR/CoT 提示词框架。',
    bodyEn:
      'Toggle between Live Playground (auto-generated form, fullscreen reader, .md export, live HITL approval edits) and Node Inspector (variable chips, prompt boosters, single-node test).',
    tipZh: '遇到金色 HITL 审批节点时，可在此在线改稿后点击放行',
    tipEn: 'Pause & edit drafts inline whenever a gold HITL Approval node triggers',
  },
  {
    id: 'views',
    targetSelector: '[data-tour="top-nav"]',
    titleZh: '⑥ 五大平台级专业工作区',
    titleEn: '6. Five Enterprise Platform Views',
    bodyZh:
      '顶部标签可随时切换：「A/B 竞技场」双策略并行 PK 打分；「自动化评测」一键跑断言回归集；「可观测大盘」看耗时与 Token 遥测；「发布与 API」秒变客户可用 Web App + cURL/Python/TS 代码与定时 Webhook！',
    bodyEn:
      'Switch views anytime: A/B Arena (parallel model/prompt duels), Eval Suite (assertion regression testing), Analytics (latency & token telemetry), and Deploy & API (client Mini-App + SDK + Cron Webhooks).',
    tipZh: '点击顶栏历史图标还可把任意历史记录在画布上逐帧回放',
    tipEn: 'Open History in the top bar for frame-by-frame Canvas Replay',
  },
  {
    id: 'settings',
    targetSelector: '[data-tour="top-right-tools"]',
    titleZh: '⑦ 真实大模型接入、版本快照与主题切换',
    titleEn: '7. Live LLM BYOK, Snapshots & Themes',
    bodyZh:
      '点击「演示引擎」可切换 DeepSeek / OpenAI / 千问 / 本地 Ollama（密钥经 Fernet 加密存储）；旁边可管理版本快照 Diff 回滚、历史回放、白日/暗黑主题与中英双语。随时点「?」可重新打开本引导！',
    bodyEn:
      'Click Demo Engine to connect DeepSeek, OpenAI, Qwen, or Ollama (Fernet-encrypted keys), manage Version Diffs, Trace Replay, Dark/Light themes, and ZH/EN. Click "?" anytime to replay this tour!',
    tipZh: '恭喜上手！现在可以自由探索 SynthFlow Studio 了',
    tipEn: 'You are all set! Enjoy building with SynthFlow Studio',
  },
]

const STORAGE_KEY = 'synthflow_tour_done_v1'

export function OnboardingTour() {
  const isOpen = useStudioStore((s) => s.isTourOpen)
  const setOpen = useStudioStore((s) => s.setTourOpen)
  const language = useStudioStore((s) => s.language)
  const setWorkspaceView = useStudioStore((s) => s.setWorkspaceView)
  const startExecution = useStudioStore((s) => s.startExecution)
  const setCopilotOpen = useStudioStore((s) => s.setCopilotOpen)
  const selectWorkflow = useStudioStore((s) => s.selectWorkflow)
  const workflows = useStudioStore((s) => s.workflows)

  const [stepIdx, setStepIdx] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const isEn = language === 'en'
  const step = TOUR_STEPS[stepIdx]

  // Auto-open once for first-time visitors after studio finishes loading
  useEffect(() => {
    if (workflows.length === 0) return
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const timer = setTimeout(() => setOpen(true), 550)
        return () => clearTimeout(timer)
      }
    } catch {
      // ignore storage errors
    }
  }, [workflows.length, setOpen])

  useEffect(() => {
    if (!isOpen) return
    setWorkspaceView('studio')
  }, [isOpen, setWorkspaceView])

  useEffect(() => {
    if (!isOpen || !step) return
    const updateRect = () => {
      const el = document.querySelector(step.targetSelector)
      if (el) {
        setRect(el.getBoundingClientRect())
      } else {
        setRect(null)
      }
    }
    updateRect()
    const timer = setTimeout(updateRect, 120)
    window.addEventListener('resize', updateRect)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateRect)
    }
  }, [isOpen, step])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
      else if (e.key === 'ArrowRight') {
        if (stepIdx < TOUR_STEPS.length - 1) setStepIdx((s) => s + 1)
        else handleClose()
      } else if (e.key === 'ArrowLeft' && stepIdx > 0) {
        setStepIdx((s) => s - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, stepIdx])

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // ignore
    }
    setOpen(false)
    setStepIdx(0)
  }

  const handleStepAction = () => {
    if (!step.actionKind) return
    if (step.actionKind === 'hitl') {
      selectWorkflow('tpl-hitl-approval')
      setStepIdx((s) => Math.min(TOUR_STEPS.length - 1, s + 1))
    } else if (step.actionKind === 'copilot') {
      handleClose()
      setCopilotOpen(true)
    } else if (step.actionKind === 'run') {
      handleClose()
      startExecution()
    }
  }

  if (!isOpen || !step) return null

  // Compute safe popover position without overflowing 1280x800 viewport
  const cardWidth = 370
  const cardHeight = 250
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800

  let cardLeft = Math.round((vw - cardWidth) / 2)
  let cardTop = Math.round((vh - cardHeight) / 2)

  if (rect) {
    const pad = 16
    if (step.id === 'templates') {
      cardLeft = Math.min(vw - cardWidth - pad, rect.right + 16)
      cardTop = Math.max(72, Math.min(vh - cardHeight - pad, rect.top + 60))
    } else if (step.id === 'playground') {
      cardLeft = Math.max(pad, rect.left - cardWidth - 16)
      cardTop = Math.max(72, Math.min(vh - cardHeight - pad, rect.top + 60))
    } else if (step.id === 'canvas') {
      cardLeft = Math.round(rect.left + Math.max(16, (rect.width - cardWidth) / 2))
      cardTop = Math.min(vh - cardHeight - 80, rect.top + 88)
    } else {
      // Top bar / top canvas targets -> place right underneath
      cardLeft = Math.max(pad, Math.min(vw - cardWidth - pad, rect.left + rect.width / 2 - cardWidth / 2))
      cardTop = Math.min(vh - cardHeight - pad, rect.bottom + 14)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] pointer-events-auto">
      {/* Dimmed backdrop */}
      <div
        onClick={handleClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] transition-opacity"
      />

      {/* Glowing Spotlight Frame around target element */}
      {rect && (
        <div
          style={{
            left: Math.max(2, rect.left - 5),
            top: Math.max(2, rect.top - 5),
            width: Math.min(vw - 4, rect.width + 10),
            height: Math.min(vh - 4, rect.height + 10),
            boxShadow:
              '0 0 0 2px rgba(139, 92, 246, 0.95), 0 0 0 6px rgba(139, 92, 246, 0.28), 0 0 36px rgba(56, 189, 248, 0.45)',
          }}
          className="pointer-events-none fixed rounded-2xl transition-all duration-300 ease-out"
        />
      )}

      {/* Floating Tour Guide Card */}
      <div
        style={{ left: cardLeft, top: cardTop, width: cardWidth }}
        className="fixed z-[65] overflow-hidden rounded-2xl border border-violet-500/45 bg-white dark:bg-[#111827] shadow-2xl transition-all duration-300"
      >
        <div className="h-1 w-full bg-slate-200 dark:bg-white/10">
          <div
            style={{ width: `${Math.round(((stepIdx + 1) / TOUR_STEPS.length) * 100)}%` }}
            className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400 transition-all duration-300"
          />
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/15 text-violet-500">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="text-[11px] font-mono font-bold text-violet-600 dark:text-violet-300">
                {isEn ? `GUIDE ${stepIdx + 1} / ${TOUR_STEPS.length}` : `新手引导 ${stepIdx + 1} / ${TOUR_STEPS.length}`}
              </span>
            </div>
            <button
              onClick={handleClose}
              title={isEn ? 'Skip tour' : '跳过引导'}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
              {isEn ? step.titleEn : step.titleZh}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {isEn ? step.bodyEn : step.bodyZh}
            </p>
          </div>

          <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.07] px-3 py-2 text-[11px] text-violet-700 dark:text-violet-200">
            💡 {isEn ? step.tipEn : step.tipZh}
          </div>

          {/* Interactive Try-It-Now Button */}
          {step.actionKind && (
            <button
              onClick={handleStepAction}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-cyan-500/35 bg-gradient-to-r from-violet-600/15 to-cyan-500/15 hover:from-violet-600/25 hover:to-cyan-500/25 py-2 text-xs font-bold text-violet-700 dark:text-cyan-300 transition-all"
            >
              {step.actionKind === 'run' ? (
                <Play className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              <span>{isEn ? step.actionLabelEn : step.actionLabelZh}</span>
            </button>
          )}

          {/* Footer Stepper Controls */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 dark:border-white/[0.08]">
            <button
              onClick={handleClose}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              {isEn ? 'Skip' : '不再提示'}
            </button>

            <div className="flex items-center gap-1.5">
              {stepIdx > 0 && (
                <button
                  onClick={() => setStepIdx((s) => s - 1)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>{isEn ? 'Back' : '上一步'}</span>
                </button>
              )}
              {stepIdx < TOUR_STEPS.length - 1 ? (
                <button
                  onClick={() => setStepIdx((s) => s + 1)}
                  className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:brightness-110 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-violet-600/25"
                >
                  <span>{isEn ? 'Next' : '下一步'}</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              ) : (
                <button
                  onClick={handleClose}
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-600/25"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{isEn ? 'Start Building' : '完成并开始使用'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
