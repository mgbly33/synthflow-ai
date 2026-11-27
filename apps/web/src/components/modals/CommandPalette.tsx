import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Cpu,
  GitCommitHorizontal,
  History,
  Layers,
  LayoutGrid,
  Play,
  Plus,
  Rocket,
  Search,
  SunMoon,
  Workflow,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStudioStore } from '../../store/useStudioStore'
import type { SynthNodeType } from '../../types/workflow'
import { NODE_ACCENT_META } from '../../utils/layout'

interface PaletteAction {
  id: string
  group: string
  title: string
  subtitle?: string
  color?: string
  icon?: React.FC<{ className?: string }>
  run: () => void
}

const ALL_NODE_TYPES: SynthNodeType[] = [
  'llm',
  'knowledge',
  'condition',
  'classifier',
  'approval',
  'http',
  'code',
  'aggregator',
  'loop',
  'note',
  'input',
  'output',
]

export function CommandPalette() {
  const { t } = useTranslation()
  const isOpen = useStudioStore((s) => s.isCommandOpen)
  const setOpen = useStudioStore((s) => s.setCommandOpen)
  const workflows = useStudioStore((s) => s.workflows)
  const nodes = useStudioStore((s) => s.nodes)
  const selectWorkflow = useStudioStore((s) => s.selectWorkflow)
  const selectNode = useStudioStore((s) => s.selectNode)
  const addNode = useStudioStore((s) => s.addNode)
  const startExecution = useStudioStore((s) => s.startExecution)
  const autoLayout = useStudioStore((s) => s.autoLayout)
  const setWorkspaceView = useStudioStore((s) => s.setWorkspaceView)
  const setSettingsOpen = useStudioStore((s) => s.setSettingsOpen)
  const setHistoryOpen = useStudioStore((s) => s.setHistoryOpen)
  const setVersionsOpen = useStudioStore((s) => s.setVersionsOpen)
  const toggleTheme = useStudioStore((s) => s.toggleTheme)

  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!isOpen) setQuery('')
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, setOpen])

  const actions = useMemo<PaletteAction[]>(() => {
    const list: PaletteAction[] = [
      {
        id: 'act-run',
        group: '快捷操作 / Quick Actions',
        title: t('runWorkflow'),
        subtitle: 'Execute current DAG with live SSE streaming',
        icon: Play,
        run: () => {
          setWorkspaceView('studio')
          startExecution()
        },
      },
      {
        id: 'act-layout',
        group: '快捷操作 / Quick Actions',
        title: t('autoLayout'),
        subtitle: 'Arrange nodes cleanly left-to-right',
        icon: LayoutGrid,
        run: () => autoLayout(),
      },
      {
        id: 'act-analytics',
        group: '切换视图 / Switch Views',
        title: t('viewAnalytics'),
        subtitle: 'Latency trends, token cost & node telemetry',
        icon: BarChart3,
        run: () => setWorkspaceView('analytics'),
      },
      {
        id: 'act-deploy',
        group: '切换视图 / Switch Views',
        title: t('viewDeploy'),
        subtitle: 'Interactive end-user Mini-App & cURL/Python/TS API SDK',
        icon: Rocket,
        run: () => setWorkspaceView('deploy'),
      },
      {
        id: 'act-versions',
        group: '快捷操作 / Quick Actions',
        title: t('versions'),
        subtitle: 'Publish checkpoints or rollback workflow snapshot',
        icon: GitCommitHorizontal,
        run: () => setVersionsOpen(true),
      },
      {
        id: 'act-history',
        group: '快捷操作 / Quick Actions',
        title: t('history'),
        subtitle: 'Inspect trace waterfall replay logs',
        icon: History,
        run: () => setHistoryOpen(true),
      },
      {
        id: 'act-settings',
        group: '快捷操作 / Quick Actions',
        title: t('settings'),
        subtitle: 'Switch Demo Engine / DeepSeek / OpenAI / Ollama',
        icon: Cpu,
        run: () => setSettingsOpen(true),
      },
      {
        id: 'act-theme',
        group: '快捷操作 / Quick Actions',
        title: '切换暗黑 / 白日主题 · Toggle Theme',
        icon: SunMoon,
        run: () => toggleTheme(),
      },
    ]

    for (const nt of ALL_NODE_TYPES) {
      list.push({
        id: `add-${nt}`,
        group: '添加节点 / Insert Node',
        title: `+ ${t(`nodeTypes.${nt}`)}`,
        subtitle: t(`nodeDescs.${nt}`),
        color: NODE_ACCENT_META[nt].color,
        icon: Plus,
        run: () => {
          setWorkspaceView('studio')
          addNode(nt)
        },
      })
    }

    for (const wf of workflows) {
      list.push({
        id: `wf-${wf.id}`,
        group: '切换工作流与模板 / Workflows & Templates',
        title: wf.name,
        subtitle: wf.description,
        icon: wf.is_template ? Layers : Workflow,
        run: () => {
          setWorkspaceView('studio')
          selectWorkflow(wf.id)
        },
      })
    }

    for (const n of nodes) {
      const nt = (n.type || 'llm') as SynthNodeType
      list.push({
        id: `jump-${n.id}`,
        group: '定位当前画布节点 / Jump to Node',
        title: n.data.label || n.id,
        subtitle: `${t(`nodeTypes.${nt}`)} · ${n.id}`,
        color: NODE_ACCENT_META[nt]?.color,
        run: () => {
          setWorkspaceView('studio')
          selectNode(n.id)
        },
      })
    }

    return list
  }, [
    t,
    workflows,
    nodes,
    setWorkspaceView,
    startExecution,
    autoLayout,
    setVersionsOpen,
    setHistoryOpen,
    setSettingsOpen,
    toggleTheme,
    addNode,
    selectWorkflow,
    selectNode,
  ])

  if (!isOpen) return null

  const q = query.trim().toLowerCase()
  const filtered = q
    ? actions.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.subtitle || '').toLowerCase().includes(q) ||
          a.group.toLowerCase().includes(q),
      )
    : actions.slice(0, 18)

  return (
    <div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 pt-[12vh] px-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#111724] shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-white/10 px-4 py-3">
          <Search className="h-4 w-4 text-violet-500 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('commandPaletteHint')}
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
          />
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No matching commands</div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    item.run()
                    setOpen(false)
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-violet-500/10 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.color ? (
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                    ) : Icon ? (
                      <Icon className="h-4 w-4 text-violet-500 shrink-0" />
                    ) : null}
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div className="truncate text-[11px] text-slate-400">{item.subtitle}</div>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                    {item.group.split(' / ')[0]}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
