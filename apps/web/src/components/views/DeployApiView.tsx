import { useEffect, useState } from 'react'
import {
  CalendarClock,
  Check,
  Code2,
  Copy,
  Loader2,
  Play,
  Plus,
  Rocket,
  Sparkles,
  Terminal,
  Trash2,
  Webhook,
  Zap,
} from 'lucide-react'
import { api } from '../../api/client'
import { useStudioStore } from '../../store/useStudioStore'
import type { ScheduleItem } from '../../types/workflow'
import { MarkdownViewer } from '../common/MarkdownViewer'

export function DeployApiView() {
  const workflows = useStudioStore((s) => s.workflows)
  const activeWorkflowId = useStudioStore((s) => s.activeWorkflowId)
  const selectWorkflow = useStudioStore((s) => s.selectWorkflow)
  const workflowName = useStudioStore((s) => s.workflowName)
  const nodes = useStudioStore((s) => s.nodes)
  const runInputs = useStudioStore((s) => s.runInputs)
  const setRunInput = useStudioStore((s) => s.setRunInput)
  const fillSampleInputs = useStudioStore((s) => s.fillSampleInputs)
  const startExecution = useStudioStore((s) => s.startExecution)
  const isRunning = useStudioStore((s) => s.isRunning)
  const finalOutput = useStudioStore((s) => s.finalOutput)
  const lastRunStats = useStudioStore((s) => s.lastRunStats)

  const [sdkTab, setSdkTab] = useState<'curl' | 'python' | 'ts'>('curl')
  const [copiedSdk, setCopiedSdk] = useState(false)
  const language = useStudioStore((s) => s.language)
  const showToast = useStudioStore((s) => s.showToast)

  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [schName, setSchName] = useState('')
  const [schCron, setSchCron] = useState('0 9 * * 1-5')
  const [triggeringId, setTriggeringId] = useState<string | null>(null)
  const [webhookReceipt, setWebhookReceipt] = useState<string>('')

  const loadSchedules = async () => {
    const list = await api.listSchedules()
    setSchedules(list)
  }

  useEffect(() => {
    loadSchedules()
  }, [activeWorkflowId])

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeWorkflowId || !schName.trim()) return
    await api.createSchedule({
      workflow_id: activeWorkflowId,
      name: schName.trim(),
      cron_expression: schCron.trim() || '0 9 * * *',
      inputs_json: runInputs,
    })
    setSchName('')
    await loadSchedules()
    showToast('已创建定时 Cron & Webhook 自动化任务', 'success')
  }

  const handleTriggerSchedule = async (sch: ScheduleItem) => {
    setTriggeringId(sch.id)
    try {
      const res = await api.triggerWebhook(sch.workflow_id, {
        inputs: sch.inputs_json,
        language,
        schedule_id: sch.id,
      })
      setWebhookReceipt(JSON.stringify({ ok: res.ok, run_id: res.run_id, duration_ms: res.total_duration_ms, tokens: res.total_tokens }, null, 2))
      await loadSchedules()
      showToast(`Webhook 触发成功 (${res.total_duration_ms}ms)，已记入运行历史`, 'success')
    } catch (err) {
      showToast((err as Error).message, 'error')
    } finally {
      setTriggeringId(null)
    }
  }

  const inputNode = nodes.find((n) => n.type === 'input')
  const fields = inputNode?.data.fields || []
  const wfId = activeWorkflowId || 'tpl-competitor-report'
  const samplePayload = JSON.stringify({ inputs: runInputs, language: 'zh' }, null, 2)

  const snippets = {
    curl: `curl -N -X POST "http://127.0.0.1:8000/api/workflows/${wfId}/run" \\
  -H "Content-Type: application/json" \\
  -H "Accept: text/event-stream" \\
  -d '${JSON.stringify({ inputs: runInputs, language: 'zh' })}'`,
    python: `import httpx

url = "http://127.0.0.1:8000/api/workflows/${wfId}/run"
payload = ${samplePayload}

with httpx.stream("POST", url, json=payload, timeout=120.0) as resp:
    for line in resp.iter_lines():
        if line.startswith("data:"):
            print(line[5:].strip())`,
    ts: `const resp = await fetch("/api/workflows/${wfId}/run", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
  body: JSON.stringify(${samplePayload}),
});

const reader = resp.body!.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(decoder.decode(value, { stream: true }));
}`,
  }

  const handleCopySdk = () => {
    navigator.clipboard.writeText(snippets[sdkTab])
    setCopiedSdk(true)
    setTimeout(() => setCopiedSdk(false), 1800)
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-[#F5F7FB] dark:bg-[#090C12] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Rocket className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              <span>
                {language === 'en'
                  ? 'Deploy as Standalone Web App, SSE API & Cron Automation'
                  : '一键发布为独立 Web App、生产级 SSE API 与定时自动化'}
              </span>
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {language === 'en'
                ? `Workflow "${workflowName}" is live as an SSE endpoint with interactive client preview and webhook triggers.`
                : `当前工作流「${workflowName}」已自动暴露为实时 SSE 端点，左侧提供终端客户视角的独立应用预览。`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeWorkflowId || ''}
              onChange={(e) => selectWorkflow(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#131926] px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-violet-500"
            >
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {language === 'en' && w.name_en ? w.name_en : w.name}
                </option>
              ))}
            </select>
            <span className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              POST /api/workflows/{wfId}/run
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Live End-User Mini-App Preview (7 cols) */}
          <div className="lg:col-span-7 overflow-hidden rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#111724] shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.08] bg-gradient-to-r from-violet-600/15 via-indigo-500/10 to-cyan-500/10 px-5 py-4">
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-400" />
                  <span>{workflowName} · 客户交付版 Web 应用预览</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  终端客户无需接触节点画布，填写表单即可直接获取 AI 流式交付报告
                </div>
              </div>
              <button
                onClick={fillSampleInputs}
                className="rounded-xl bg-violet-500/15 hover:bg-violet-500/25 px-3 py-1.5 text-xs font-semibold text-violet-500 dark:text-violet-300"
              >
                填入示例
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {fields.map((f) => (
                  <div key={f.name}>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {f.label}
                    </label>
                    {f.type === 'textarea' ? (
                      <textarea
                        rows={3}
                        value={runInputs[f.name] || ''}
                        onChange={(e) => setRunInput(f.name, e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#090C12] px-3 py-2 text-xs outline-none focus:border-violet-500"
                      />
                    ) : (
                      <input
                        value={runInputs[f.name] || ''}
                        onChange={(e) => setRunInput(f.name, e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#090C12] px-3 py-2 text-xs outline-none focus:border-violet-500"
                      />
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={startExecution}
                disabled={isRunning}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:brightness-110 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30 disabled:opacity-60"
              >
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                <span>{isRunning ? 'AI 智能体协同生成中...' : '立即生成交付成果'}</span>
              </button>

              {finalOutput && (
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#0A0E16] p-5 max-h-[420px] overflow-y-auto">
                  <MarkdownViewer content={finalOutput} />
                  {lastRunStats && (
                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 text-[11px] font-mono text-slate-400 flex justify-between">
                      <span>Completed in {lastRunStats.durationMs}ms</span>
                      <span>{lastRunStats.totalTokens} tokens</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: API SDK Snippets (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#111724] shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.08] px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                  <Code2 className="h-4 w-4 text-cyan-400" />
                  <span>API 实时流式接入代码</span>
                </div>
                <button
                  onClick={handleCopySdk}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-white/10 px-2.5 py-1 text-[11px] font-medium"
                >
                  {copiedSdk ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedSdk ? '已复制' : '复制代码'}</span>
                </button>
              </div>

              <div className="flex gap-1 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0B0F17] px-3 py-2">
                {(['curl', 'python', 'ts'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSdkTab(tab)}
                    className={[
                      'rounded-lg px-2.5 py-1 text-[11px] font-mono font-semibold uppercase',
                      sdkTab === tab
                        ? 'bg-violet-600 text-white'
                        : 'text-slate-500 hover:text-slate-200',
                    ].join(' ')}
                  >
                    {tab === 'ts' ? 'TypeScript' : tab}
                  </button>
                ))}
              </div>

              <pre className="overflow-x-auto bg-[#090C12] p-4 font-mono text-[11.5px] leading-relaxed text-cyan-200">
                <code>{snippets[sdkTab]}</code>
              </pre>
            </div>

            <div className="rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#111724] p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <Terminal className="h-4 w-4 text-violet-400" />
                <span>SSE 标准事件协议说明</span>
              </div>
              <ul className="space-y-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                <li><span className="text-violet-400">run_started</span> — DAG 拓扑分层与运行 ID 初始化</li>
                <li><span className="text-sky-400">node_started</span> — 节点进入执行态，返回 offset_ms</li>
                <li><span className="text-emerald-400">node_token</span> — LLM / Loop 逐 Token 增量推送</li>
                <li><span className="text-amber-400">node_completed</span> — 耗时 ms、Tokens 与激活连线列表</li>
                <li><span className="text-slate-400">node_skipped</span> — 条件/意图未命中分支优雅跳过</li>
                <li><span className="text-indigo-400">run_completed</span> — 最终 Markdown 成品与总统计</li>
              </ul>
            </div>

            {/* Cron Schedule & Webhook Simulator */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#111724] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                  <CalendarClock className="h-4 w-4 text-emerald-400" />
                  <span>定时 Cron 调度 & Webhook 触发器</span>
                </div>
                <Webhook className="h-4 w-4 text-slate-400" />
              </div>

              <form onSubmit={handleCreateSchedule} className="grid grid-cols-12 gap-2">
                <input
                  value={schName}
                  onChange={(e) => setSchName(e.target.value)}
                  placeholder="任务名（如：每日研报推送）"
                  className="col-span-6 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#090C12] px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                />
                <input
                  value={schCron}
                  onChange={(e) => setSchCron(e.target.value)}
                  placeholder="0 9 * * 1-5"
                  className="col-span-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#090C12] px-2.5 py-1.5 font-mono text-xs outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="col-span-2 inline-flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white"
                  title="Add Schedule"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </form>

              <div className="space-y-2 max-h-52 overflow-y-auto">
                {schedules.map((sch) => (
                  <div
                    key={sch.id}
                    className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#0B0F17] p-2.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {sch.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleTriggerSchedule(sch)}
                          disabled={triggeringId === sch.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 px-2 py-1 text-[10.5px] font-bold text-emerald-500"
                        >
                          {triggeringId === sch.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                          <span>触发</span>
                        </button>
                        <button
                          onClick={async () => {
                            await api.deleteSchedule(sch.id)
                            await loadSchedules()
                          }}
                          className="rounded p-1 text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>CRON: {sch.cron_expression}</span>
                      <span>已触发 {sch.trigger_count} 次</span>
                    </div>
                  </div>
                ))}
              </div>

              {webhookReceipt && (
                <pre className="rounded-xl bg-[#090C12] p-2.5 font-mono text-[10.5px] text-emerald-300 overflow-x-auto">
                  {webhookReceipt}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
