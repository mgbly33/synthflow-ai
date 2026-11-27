import { useEffect } from 'react'
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  ExternalLink,
  RefreshCw,
  Zap,
} from 'lucide-react'
import { useStudioStore } from '../../store/useStudioStore'
import type { SynthNodeType } from '../../types/workflow'
import { NODE_ACCENT_META } from '../../utils/layout'

export function AnalyticsView() {
  const language = useStudioStore((s) => s.language)
  const summary = useStudioStore((s) => s.analyticsSummary)
  const isLoading = useStudioStore((s) => s.isLoadingAnalytics)
  const refreshAnalytics = useStudioStore((s) => s.refreshAnalytics)
  const runs = useStudioStore((s) => s.runs)
  const selectRunDetail = useStudioStore((s) => s.selectRunDetail)
  const setHistoryOpen = useStudioStore((s) => s.setHistoryOpen)
  const isEn = language === 'en'

  useEffect(() => {
    refreshAnalytics()
  }, [refreshAnalytics])

  const maxDur = Math.max(100, ...(summary?.recent_trend || []).map((p) => p.duration_ms))

  return (
    <div className="h-full w-full overflow-y-auto bg-[#F5F7FB] dark:bg-[#090C12] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <BarChart3 className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              <span>{isEn ? 'Observability, Latency & Token Telemetry' : '可观测性、耗时与 Token 成本大盘'}</span>
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {isEn
                ? 'Live telemetry across all DAG workflow runs, node latency bottlenecks, and token economics.'
                : '实时统计所有 DAG 工作流运行成功率、节点性能瓶颈与推理 Token 经济性指标。'}
            </p>
          </div>
          <button
            onClick={refreshAnalytics}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#131926] hover:bg-slate-100 dark:hover:bg-white/10 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isEn ? 'Refresh' : '刷新遥测'}</span>
          </button>
        </div>

        {/* 4 KPI Hero Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: '累计执行次数 · Total Runs',
              value: String(summary?.total_runs ?? 0),
              sub: `${summary?.total_workflows ?? 8} 工作流 · ${summary?.total_knowledge_docs ?? 3} 知识文档`,
              icon: Activity,
              color: '#8B5CF6',
            },
            {
              label: '执行成功率 · Success Rate',
              value: `${summary?.success_rate ?? 100}%`,
              sub: `成功 ${summary?.completed_runs ?? 0} / 失败 ${summary?.failed_runs ?? 0}`,
              icon: CheckCircle2,
              color: '#10B981',
            },
            {
              label: '平均端到端耗时 · Avg Latency',
              value: `${summary?.avg_duration_ms ?? 0} ms`,
              sub: '包含同层节点并发加速调度',
              icon: Clock,
              color: '#0EA5E9',
            },
            {
              label: '累计 Token & 演示节省',
              value: `${(summary?.total_tokens ?? 0).toLocaleString()} tok`,
              sub: `较商业 API 预估节省 $${(summary?.estimated_saved_usd ?? 0).toFixed(3)}`,
              icon: Coins,
              color: '#F59E0B',
            },
          ].map((kpi) => {
            const Icon = kpi.icon
            return (
              <div
                key={kpi.label}
                className="rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#111724] p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {kpi.label}
                  </span>
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${kpi.color}1C`, color: kpi.color }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
                  {kpi.value}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">{kpi.sub}</div>
              </div>
            )
          })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Latency Bar Trend */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#111724] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  近期运行耗时趋势（Latency Telemetry）
                </h2>
                <p className="text-[11px] text-slate-400">最近 16 次工作流运行端到端延迟对比</p>
              </div>
              <span className="rounded-lg bg-violet-500/15 px-2.5 py-1 text-[10px] font-mono font-semibold text-violet-400">
                SSE Streaming
              </span>
            </div>

            {!summary || summary.recent_trend.length === 0 ? (
              <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-white/10 text-xs text-slate-400">
                在画布中运行任意工作流后，此处将实时绘制耗时趋势柱状图。
              </div>
            ) : (
              <div className="flex h-48 items-end gap-2 pt-4 px-2">
                {summary.recent_trend.map((pt, idx) => {
                  const pct = Math.max(10, Math.round((pt.duration_ms / maxDur) * 100))
                  return (
                    <div
                      key={pt.run_id || idx}
                      onClick={() => {
                        selectRunDetail(pt.run_id)
                        setHistoryOpen(true)
                      }}
                      title={`${pt.workflow_name}: ${pt.duration_ms}ms · ${pt.tokens} tok`}
                      className="group flex-1 flex flex-col items-center gap-1.5 cursor-pointer h-full justify-end"
                    >
                      <span className="text-[9px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {pt.duration_ms}ms
                      </span>
                      <div
                        style={{ height: `${pct}%` }}
                        className={[
                          'w-full max-w-[34px] rounded-t-lg transition-all group-hover:brightness-125',
                          pt.status === 'FAILED'
                            ? 'bg-gradient-to-t from-rose-600 to-rose-400'
                            : 'bg-gradient-to-t from-violet-600 via-indigo-500 to-cyan-400',
                        ].join(' ')}
                      />
                      <span className="text-[9px] font-mono text-slate-400 truncate max-w-[44px]">
                        #{idx + 1}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Node-Type Telemetry Breakdown */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#111724] p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Cpu className="h-4 w-4 text-cyan-400" />
              <span>节点类型性能分布</span>
            </h2>
            {!summary || summary.node_type_stats.length === 0 ? (
              <p className="text-xs text-slate-400 py-12 text-center">暂无节点调用统计</p>
            ) : (
              <div className="space-y-3">
                {summary.node_type_stats.map((st) => {
                  const meta = NODE_ACCENT_META[st.node_type as SynthNodeType] || NODE_ACCENT_META.llm
                  const maxExec = Math.max(1, summary.node_type_stats[0].executions)
                  const widthPct = Math.max(12, Math.round((st.executions / maxExec) * 100))
                  return (
                    <div key={st.node_type} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {st.executions}x · avg {st.avg_duration_ms}ms
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                        <div
                          style={{ width: `${widthPct}%`, backgroundColor: meta.color }}
                          className="h-full rounded-full"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Runs Table */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#111724] overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.08] px-5 py-3.5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <span>最近运行流水记录</span>
            </h2>
            <span className="text-[11px] text-slate-400">点击任意行打开 Trace 瀑布流回放</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.03] text-[11px] font-mono uppercase text-slate-400">
                <tr>
                  <th className="px-5 py-2.5">Workflow</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Provider</th>
                  <th className="px-4 py-2.5">Duration</th>
                  <th className="px-4 py-2.5">Tokens</th>
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/[0.06]">
                {runs.slice(0, 12).map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => {
                      selectRunDetail(r.id)
                      setHistoryOpen(true)
                    }}
                    className="cursor-pointer hover:bg-violet-500/[0.06] transition-colors"
                  >
                    <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-100">
                      {r.workflow_name}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <span
                        className={
                          r.status === 'COMPLETED'
                            ? 'text-emerald-500'
                            : r.status === 'FAILED'
                              ? 'text-rose-500'
                              : 'text-amber-500'
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">{r.provider_mode}</td>
                    <td className="px-4 py-3 font-mono">{r.total_duration_ms} ms</td>
                    <td className="px-4 py-3 font-mono">{r.total_tokens}</td>
                    <td className="px-4 py-3 text-slate-400">{new Date(r.started_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <ExternalLink className="h-3.5 w-3.5 text-slate-400 inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
