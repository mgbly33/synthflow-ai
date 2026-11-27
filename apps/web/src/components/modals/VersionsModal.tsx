import React, { useMemo, useState } from 'react'
import { GitCommitHorizontal, GitCompare, Plus, RotateCcw, X } from 'lucide-react'
import { useStudioStore } from '../../store/useStudioStore'
import type { WorkflowVersionItem } from '../../types/workflow'

export function VersionsModal() {
  const isOpen = useStudioStore((s) => s.isVersionsOpen)
  const setOpen = useStudioStore((s) => s.setVersionsOpen)
  const versions = useStudioStore((s) => s.versions)
  const liveNodes = useStudioStore((s) => s.nodes)
  const liveEdges = useStudioStore((s) => s.edges)
  const publishVersion = useStudioStore((s) => s.publishVersion)
  const restoreVersion = useStudioStore((s) => s.restoreVersion)

  const [tag, setTag] = useState('')
  const [note, setNote] = useState('')
  const [diffVer, setDiffVer] = useState<WorkflowVersionItem | null>(null)

  const diffReport = useMemo(() => {
    if (!diffVer) return null
    const snapNodes = diffVer.graph_json?.nodes || []
    const snapEdges = diffVer.graph_json?.edges || []
    const snapMap = new Map(snapNodes.map((n) => [n.id, n]))
    const liveMap = new Map(liveNodes.map((n) => [n.id, n]))

    const added = liveNodes.filter((n) => !snapMap.has(n.id))
    const removed = snapNodes.filter((n) => !liveMap.has(n.id))
    const modified = liveNodes.filter((n) => {
      const prev = snapMap.get(n.id)
      return prev && JSON.stringify(prev.data) !== JSON.stringify(n.data)
    })
    return {
      added,
      removed,
      modified,
      edgeDelta: liveEdges.length - snapEdges.length,
    }
  }, [diffVer, liveNodes, liveEdges])

  if (!isOpen) return null

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()
    await publishVersion(tag, note)
    setTag('')
    setNote('')
  }

  return (
    <div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#111724] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <GitCommitHorizontal className="h-5 w-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              版本快照、可视化 DAG Diff 对比与回滚
            </h2>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <form onSubmit={handlePublish} className="rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06] p-3.5 space-y-2.5">
            <div className="text-xs font-semibold text-cyan-600 dark:text-cyan-300">
              发布当前画布为新版本快照
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="版本号如 v1.2"
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#090C12] px-2.5 py-1.5 font-mono text-xs outline-none focus:border-cyan-500"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="变更说明（如：新增审批门控与质检官）"
                className="col-span-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#090C12] px-2.5 py-1.5 text-xs outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-3.5 py-1.5 text-xs font-bold text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>发布快照</span>
              </button>
            </div>
          </form>

          {/* Visual Diff Inspector Panel */}
          {diffVer && diffReport && (
            <div className="rounded-xl border border-violet-500/35 bg-violet-500/[0.06] p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-violet-500 dark:text-violet-300 flex items-center gap-1.5">
                  <GitCompare className="h-4 w-4" />
                  当前画布 vs 快照 {diffVer.tag} 差异对比
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  Edge Δ: {diffReport.edgeDelta >= 0 ? `+${diffReport.edgeDelta}` : diffReport.edgeDelta}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 font-mono text-[11px]">
                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-emerald-500">
                  + 新增节点: {diffReport.added.length}
                </span>
                <span className="rounded-md bg-rose-500/15 px-2 py-0.5 text-rose-500">
                  - 删除节点: {diffReport.removed.length}
                </span>
                <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-500">
                  ~ 参数变更: {diffReport.modified.length}
                </span>
              </div>
              {(diffReport.added.length > 0 || diffReport.removed.length > 0 || diffReport.modified.length > 0) ? (
                <div className="space-y-1 pt-1 text-[11px] font-mono">
                  {diffReport.added.map((n) => (
                    <div key={n.id} className="text-emerald-400">+ [{n.type}] {n.data.label || n.id}</div>
                  ))}
                  {diffReport.removed.map((n) => (
                    <div key={n.id} className="text-rose-400">- [{n.type}] {n.data.label || n.id}</div>
                  ))}
                  {diffReport.modified.map((n) => (
                    <div key={n.id} className="text-amber-400">~ [{n.type}] {n.data.label || n.id} (config changed)</div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400">当前画布与快照 {diffVer.tag} 完全一致。</div>
              )}
            </div>
          )}

          <div className="max-h-64 overflow-y-auto space-y-2">
            {versions.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                当前工作流尚未发布快照，在上方填写说明即可留存可对比和回滚的版本检查点。
              </p>
            ) : (
              versions.map((ver) => (
                <div
                  key={ver.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#151C2A] p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 font-mono text-xs font-bold text-cyan-500">
                        {ver.tag}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {ver.node_count}N · {ver.edge_count}E
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-700 dark:text-slate-200">{ver.note}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {new Date(ver.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setDiffVer(ver)}
                      className="inline-flex items-center gap-1 rounded-xl border border-violet-500/35 bg-violet-500/10 hover:bg-violet-500/20 px-2.5 py-1.5 text-xs font-semibold text-violet-500 dark:text-violet-300"
                    >
                      <GitCompare className="h-3.5 w-3.5" />
                      <span>Diff</span>
                    </button>
                    <button
                      onClick={() => restoreVersion(ver.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D121C] hover:border-cyan-500 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-cyan-400" />
                      <span>回滚</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
