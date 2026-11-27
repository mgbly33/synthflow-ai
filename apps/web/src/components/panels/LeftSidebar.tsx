import React, { useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  Bot,
  Boxes,
  Code2,
  Copy,
  Database,
  FileOutput,
  FileText,
  FileUp,
  GitBranch,
  Globe,
  Layers,
  Loader2,
  Merge,
  PlaySquare,
  Plus,
  Repeat,
  Search,
  ShieldAlert,
  Sparkles,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { useStudioStore } from '../../store/useStudioStore'
import type { KnowledgeSearchMatch, SynthNodeType } from '../../types/workflow'
import { NODE_ACCENT_META } from '../../utils/layout'

const NODE_GROUPS: Array<{
  groupKey: 'core' | 'routing' | 'tools'
  items: Array<{ type: SynthNodeType; icon: React.FC<{ className?: string }> }>
}> = [
  {
    groupKey: 'core',
    items: [
      { type: 'input', icon: PlaySquare },
      { type: 'llm', icon: Bot },
      { type: 'knowledge', icon: BookOpen },
      { type: 'output', icon: FileOutput },
    ],
  },
  {
    groupKey: 'routing',
    items: [
      { type: 'condition', icon: GitBranch },
      { type: 'classifier', icon: Sparkles },
      { type: 'loop', icon: Repeat },
      { type: 'approval', icon: ShieldAlert },
    ],
  },
  {
    groupKey: 'tools',
    items: [
      { type: 'http', icon: Globe },
      { type: 'code', icon: Code2 },
      { type: 'aggregator', icon: Merge },
      { type: 'note', icon: StickyNote },
    ],
  },
]

const CATEGORIES = ['all', 'research', 'marketing', 'legal', 'support', 'engineering', 'finance']

export function LeftSidebar() {
  const { t } = useTranslation()
  const fileUploadRef = useRef<HTMLInputElement>(null)

  const leftTab = useStudioStore((s) => s.leftTab)
  const setLeftTab = useStudioStore((s) => s.setLeftTab)
  const language = useStudioStore((s) => s.language)

  const addNode = useStudioStore((s) => s.addNode)
  const workflows = useStudioStore((s) => s.workflows)
  const activeWorkflowId = useStudioStore((s) => s.activeWorkflowId)
  const selectWorkflow = useStudioStore((s) => s.selectWorkflow)
  const createBlankWorkflow = useStudioStore((s) => s.createBlankWorkflow)
  const cloneWorkflow = useStudioStore((s) => s.cloneWorkflow)
  const deleteWorkflow = useStudioStore((s) => s.deleteWorkflow)

  const knowledgeDocs = useStudioStore((s) => s.knowledgeDocs)
  const createKnowledgeDoc = useStudioStore((s) => s.createKnowledgeDoc)
  const updateKnowledgeDoc = useStudioStore((s) => s.updateKnowledgeDoc)
  const deleteKnowledgeDoc = useStudioStore((s) => s.deleteKnowledgeDoc)

  const [tplSearch, setTplSearch] = useState('')
  const [tplCategory, setTplCategory] = useState('all')

  const [editingDocId, setEditingDocId] = useState<string | null>(null)
  const [docTitle, setDocTitle] = useState('')
  const [docContent, setDocContent] = useState('')
  const [showDocForm, setShowDocForm] = useState(false)
  const [expandedDocChunks, setExpandedDocChunks] = useState<Record<string, boolean>>({})

  // Live BM25 Retrieval Tester state
  const [bm25Query, setBm25Query] = useState('')
  const [bm25Loading, setBm25Loading] = useState(false)
  const [bm25Matches, setBm25Matches] = useState<KnowledgeSearchMatch[] | null>(null)

  const templates = useMemo(() => {
    return workflows.filter((w) => {
      if (!w.is_template) return false
      if (tplCategory !== 'all' && w.category !== tplCategory) return false
      if (tplSearch.trim()) {
        const q = tplSearch.toLowerCase()
        return (
          w.name.toLowerCase().includes(q) ||
          w.name_en.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [workflows, tplCategory, tplSearch])

  const totalTemplateCount = workflows.filter((w) => w.is_template).length
  const customWorkflows = workflows.filter((w) => !w.is_template)

  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!docTitle.trim() || !docContent.trim()) return
    if (editingDocId) {
      await updateKnowledgeDoc(editingDocId, docTitle.trim(), docContent.trim())
    } else {
      await createKnowledgeDoc(docTitle.trim(), docContent.trim())
    }
    setDocTitle('')
    setDocContent('')
    setEditingDocId(null)
    setShowDocForm(false)
  }

  const handleUploadMd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const content = String(reader.result || '').trim()
      if (content) {
        await createKnowledgeDoc(file.name.replace(/\.(md|txt)$/i, ''), content)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleBm25Search = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bm25Query.trim()) return
    setBm25Loading(true)
    try {
      const res = await api.searchKnowledge({ query: bm25Query.trim(), top_k: 3 })
      setBm25Matches(res.matches)
    } finally {
      setBm25Loading(false)
    }
  }

  return (
    <aside
      data-tour="left-sidebar"
      className="flex h-full w-[292px] shrink-0 flex-col border-r border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0D121C] select-none"
    >
      {/* Tab Switcher */}
      <div className="grid grid-cols-3 gap-1 border-b border-slate-200/90 dark:border-white/[0.08] p-2">
        {[
          { id: 'nodes' as const, label: t('tabNodes'), icon: Boxes },
          { id: 'templates' as const, label: t('tabTemplates'), icon: Layers },
          { id: 'knowledge' as const, label: t('tabKnowledge'), icon: Database },
        ].map((tab) => {
          const Icon = tab.icon
          const active = leftTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setLeftTab(tab.id)}
              className={[
                'flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-semibold transition-all',
                active
                  ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300 border border-violet-500/30 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] border border-transparent',
              ].join(' ')}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* 1. 10-Node Grouped Toolbox */}
        {leftTab === 'nodes' && (
          <>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 px-1">{t('dragHint')}</p>
            {NODE_GROUPS.map((grp) => (
              <div key={grp.groupKey} className="space-y-1.5">
                <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {t(`nodeGroups.${grp.groupKey}`)}
                </div>
                <div className="space-y-1.5">
                  {grp.items.map(({ type, icon: Icon }) => {
                    const accent = NODE_ACCENT_META[type]
                    return (
                      <div
                        key={type}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/synthflow-node', type)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onClick={() => addNode(type)}
                        className="group cursor-grab active:cursor-grabbing rounded-xl border border-slate-200/90 dark:border-white/[0.07] bg-slate-50/70 dark:bg-[#131926] p-2.5 hover:border-violet-500/50 hover:bg-white dark:hover:bg-[#172032] hover:shadow-md transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border"
                            style={{
                              background: `linear-gradient(135deg, ${accent.color}25, ${accent.color}0C)`,
                              borderColor: `${accent.color}45`,
                              color: accent.color,
                            }}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                {t(`nodeTypes.${type}`)}
                              </span>
                              <Plus className="h-3.5 w-3.5 text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <p className="mt-0.5 text-[10.5px] leading-snug text-slate-500 dark:text-slate-400 line-clamp-1">
                              {t(`nodeDescs.${type}`)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        {/* 2. 8 Flagship Commercial Templates + Search & Category Filters */}
        {leftTab === 'templates' && (
          <>
            <button
              onClick={createBlankWorkflow}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-violet-500/50 bg-violet-500/5 hover:bg-violet-500/15 py-2 text-xs font-semibold text-violet-600 dark:text-violet-300 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('newBlankWorkflow')}</span>
            </button>

            {/* Search & Category Pills */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={tplSearch}
                  onChange={(e) => setTplSearch(e.target.value)}
                  placeholder={
                    language === 'en'
                      ? `Search ${totalTemplateCount} templates...`
                      : `搜索 ${totalTemplateCount} 套行业商业模板...`
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#090C12] pl-8 pr-2.5 py-1.5 text-xs outline-none focus:border-violet-500"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setTplCategory(cat)}
                    className={[
                      'rounded-lg px-2 py-0.5 text-[10px] font-mono uppercase transition-colors',
                      tplCategory === cat
                        ? 'bg-violet-600 text-white font-semibold'
                        : 'bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10',
                    ].join(' ')}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t('templatesSection')} ({templates.length})
              </div>
              {templates.map((wf) => {
                const active = wf.id === activeWorkflowId
                const title = language === 'en' && wf.name_en ? wf.name_en : wf.name
                const desc = language === 'en' && wf.description_en ? wf.description_en : wf.description
                const wfNodes = wf.graph_json?.nodes || []

                return (
                  <div
                    key={wf.id}
                    onClick={() => selectWorkflow(wf.id)}
                    className={[
                      'cursor-pointer rounded-xl border p-3 transition-all',
                      active
                        ? 'border-violet-500 bg-gradient-to-br from-violet-500/15 via-indigo-500/5 to-transparent shadow-md shadow-violet-500/10'
                        : 'border-slate-200/90 dark:border-white/[0.07] bg-slate-50/70 dark:bg-[#131926] hover:border-slate-300 dark:hover:border-white/20',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                        {title}
                      </span>
                      <span className="shrink-0 rounded-md bg-slate-200/80 dark:bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                        {wfNodes.length}N
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">
                      {desc}
                    </p>

                    {/* Mini Node-Type Color Dot Pipeline Preview */}
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        {wfNodes.slice(0, 7).map((n, i) => {
                          const nt = (n.type || 'llm') as SynthNodeType
                          return (
                            <span
                              key={n.id || i}
                              title={t(`nodeTypes.${nt}`)}
                              className="h-2 w-2 rounded-full ring-1 ring-black/20"
                              style={{ backgroundColor: NODE_ACCENT_META[nt]?.color || '#8B5CF6' }}
                            />
                          )
                        })}
                        <span className="ml-1 rounded bg-indigo-500/10 px-1.5 py-0.5 text-[9.5px] font-mono uppercase text-indigo-500 dark:text-indigo-300">
                          {wf.category}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          cloneWorkflow(wf.id)
                        }}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10.5px] font-medium text-slate-500 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/10"
                      >
                        <Copy className="h-3 w-3" />
                        <span>{t('cloneTemplate')}</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {customWorkflows.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {t('customWorkflowsSection')} ({customWorkflows.length})
                </div>
                {customWorkflows.map((wf) => {
                  const active = wf.id === activeWorkflowId
                  return (
                    <div
                      key={wf.id}
                      onClick={() => selectWorkflow(wf.id)}
                      className={[
                        'group cursor-pointer rounded-xl border p-2.5 transition-all',
                        active
                          ? 'border-violet-500 bg-violet-500/10'
                          : 'border-slate-200 dark:border-white/[0.07] bg-slate-50/70 dark:bg-[#131926] hover:border-white/20',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                          {wf.name}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteWorkflow(wf.id)
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-rose-500/15 hover:text-rose-500 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* 3. Knowledge Base Pro (Upload + Live BM25 Tester) */}
        {leftTab === 'knowledge' && (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => {
                  setEditingDocId(null)
                  setDocTitle('')
                  setDocContent('')
                  setShowDocForm(!showDocForm)
                }}
                className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/15 py-2 text-[11px] font-semibold text-amber-600 dark:text-amber-300 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t('addKnowledgeDoc')}</span>
              </button>
              <button
                onClick={() => fileUploadRef.current?.click()}
                className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#131926] hover:border-amber-500/40 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-colors"
              >
                <FileUp className="h-3.5 w-3.5 text-amber-500" />
                <span>{t('uploadMdFile')}</span>
              </button>
              <input
                ref={fileUploadRef}
                type="file"
                accept=".md,.txt"
                className="hidden"
                onChange={handleUploadMd}
              />
            </div>

            {showDocForm && (
              <form
                onSubmit={handleSaveDoc}
                className="rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#131926] p-3 space-y-2.5"
              >
                <input
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder={t('docTitle')}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#090C12] px-2.5 py-1.5 text-xs outline-none focus:border-amber-500"
                />
                <textarea
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  rows={5}
                  placeholder={t('docContent')}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#090C12] px-2.5 py-1.5 text-xs outline-none focus:border-amber-500 resize-y"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDocForm(false)}
                    className="rounded-lg px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-200/70 dark:hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1 text-xs font-bold text-slate-950"
                  >
                    {t('save')}
                  </button>
                </div>
              </form>
            )}

            {/* Live BM25 Retrieval Tester */}
            <form
              onSubmit={handleBm25Search}
              className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-2.5 space-y-2"
            >
              <div className="flex items-center justify-between text-[10.5px] font-semibold text-amber-600 dark:text-amber-300">
                <span>{t('bm25Tester')}</span>
                {bm25Loading && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
              <div className="flex gap-1.5">
                <input
                  value={bm25Query}
                  onChange={(e) => setBm25Query(e.target.value)}
                  placeholder={t('bm25Placeholder')}
                  className="flex-1 min-w-0 rounded-lg border border-amber-500/25 bg-white dark:bg-[#090C12] px-2 py-1 text-[11px] outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 hover:bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-slate-950"
                >
                  <Search className="h-3.5 w-3.5" />
                </button>
              </div>
              {bm25Matches && (
                <div className="space-y-1.5 pt-1">
                  {bm25Matches.map((m, idx) => (
                    <div
                      key={`${m.doc_id}-${m.chunk_index}-${idx}`}
                      className="rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-[#0B0F17] p-2 text-[10.5px]"
                    >
                      <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                        <span className="truncate font-semibold text-amber-600 dark:text-amber-300">
                          {m.doc_title}
                        </span>
                        <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-500">
                          {m.score}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-600 dark:text-slate-300 line-clamp-2">{m.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </form>

            {/* Knowledge Doc Cards */}
            <div className="space-y-2">
              {knowledgeDocs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => {
                    setEditingDocId(doc.id)
                    setDocTitle(doc.title)
                    setDocContent(doc.content)
                    setShowDocForm(true)
                  }}
                  className="group cursor-pointer rounded-xl border border-slate-200/90 dark:border-white/[0.07] bg-slate-50/70 dark:bg-[#131926] p-3 hover:border-amber-500/40 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {doc.title}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteKnowledgeDoc(doc.id)
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-rose-500/15 hover:text-rose-500 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {doc.content}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-amber-600 dark:text-amber-400">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedDocChunks((p) => ({ ...p, [doc.id]: !p[doc.id] }))
                      }}
                      className="rounded bg-amber-500/15 hover:bg-amber-500/25 px-1.5 py-0.5 font-semibold"
                    >
                      {doc.chunks_json?.length || 0} {t('chunksCount')} {expandedDocChunks[doc.id] ? '▴' : '▾'}
                    </button>
                    <span className="text-slate-400">{doc.content.length} chars</span>
                  </div>
                  {expandedDocChunks[doc.id] && doc.chunks_json && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 space-y-1.5 border-t border-slate-200/70 dark:border-white/10 pt-2 max-h-40 overflow-y-auto"
                    >
                      {doc.chunks_json.map((ch) => (
                        <div
                          key={ch.index}
                          className="rounded-lg bg-white dark:bg-[#090C12] border border-slate-200/80 dark:border-white/[0.08] p-2 text-[10px] text-slate-600 dark:text-slate-300"
                        >
                          <div className="font-mono text-[9.5px] text-amber-600 dark:text-amber-400 mb-0.5">
                            Chunk #{ch.index + 1} · {ch.char_count} chars
                          </div>
                          <p className="line-clamp-2">{ch.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
