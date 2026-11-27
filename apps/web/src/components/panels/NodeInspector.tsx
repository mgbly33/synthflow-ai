import {
  CheckCircle2,
  Copy,
  Layers,
  Loader2,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStudioStore } from '../../store/useStudioStore'
import type { ClassifierCategory, InputFieldSchema, SynthNodeType } from '../../types/workflow'
import { getUpstreamVariables, NODE_ACCENT_META, validateGraphClient } from '../../utils/layout'
import { MarkdownViewer } from '../common/MarkdownViewer'

export function NodeInspector() {
  const { t } = useTranslation()
  const nodes = useStudioStore((s) => s.nodes)
  const edges = useStudioStore((s) => s.edges)
  const workflowName = useStudioStore((s) => s.workflowName)
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId)
  const selectNode = useStudioStore((s) => s.selectNode)
  const updateNodeData = useStudioStore((s) => s.updateNodeData)
  const deleteNode = useStudioStore((s) => s.deleteNode)
  const duplicateNode = useStudioStore((s) => s.duplicateNode)
  const knowledgeDocs = useStudioStore((s) => s.knowledgeDocs)
  const testingNodeId = useStudioStore((s) => s.testingNodeId)
  const singleNodeResults = useStudioStore((s) => s.singleNodeResults)
  const testNodeIsolated = useStudioStore((s) => s.testNodeIsolated)
  const startExecution = useStudioStore((s) => s.startExecution)

  const node = nodes.find((n) => n.id === selectedNodeId)

  // Rich Workflow Overview Card when no node is selected (zero empty void!)
  if (!node) {
    const health = validateGraphClient(nodes, edges)
    const countByType = nodes.reduce<Record<string, number>>((acc, n) => {
      const k = n.type || 'llm'
      acc[k] = (acc[k] || 0) + 1
      return acc
    }, {})

    return (
      <div className="h-full overflow-y-auto p-4 space-y-4">
        <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/12 via-indigo-500/5 to-transparent p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                工作流拓扑概览 · Workflow Overview
              </span>
            </div>
            <span
              className={[
                'rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold',
                health.valid
                  ? 'bg-emerald-500/15 text-emerald-500'
                  : 'bg-rose-500/15 text-rose-500',
              ].join(' ')}
            >
              {health.valid ? t('dagHealthy') : t('dagInvalid')}
            </span>
          </div>

          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{workflowName}</p>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#0B0F17] p-2.5 text-center">
              <div className="text-base font-bold font-mono text-violet-500">{nodes.length}</div>
              <div className="text-[10px] text-slate-400">总节点 Nodes</div>
            </div>
            <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#0B0F17] p-2.5 text-center">
              <div className="text-base font-bold font-mono text-cyan-500">{edges.length}</div>
              <div className="text-[10px] text-slate-400">连线 Edges</div>
            </div>
            <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#0B0F17] p-2.5 text-center">
              <div className="text-base font-bold font-mono text-emerald-500">{health.layerCount}</div>
              <div className="text-[10px] text-slate-400">并发波次 Waves</div>
            </div>
          </div>

          <button
            onClick={startExecution}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:brightness-110 py-2 text-xs font-bold text-white shadow-lg shadow-violet-600/25 transition-all"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>{t('startRun')}</span>
          </button>
        </div>

        {/* Node Breakdown Quick Jump List */}
        <div className="space-y-2">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
            画布节点清单（点击快速编辑）
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {Object.entries(countByType).map(([nt, cnt]) => {
              const meta = NODE_ACCENT_META[nt as SynthNodeType] || NODE_ACCENT_META.llm
              return (
                <span
                  key={nt}
                  className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-mono"
                  style={{
                    borderColor: `${meta.color}40`,
                    backgroundColor: `${meta.color}14`,
                    color: meta.color,
                  }}
                >
                  {meta.label} ×{cnt}
                </span>
              )
            })}
          </div>
          <div className="space-y-1.5">
            {nodes.map((n) => {
              const nt = (n.type || 'llm') as SynthNodeType
              const meta = NODE_ACCENT_META[nt] || NODE_ACCENT_META.llm
              return (
                <button
                  key={n.id}
                  onClick={() => selectNode(n.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#131926] px-3 py-2 text-left hover:border-violet-500/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                    <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                      {n.data.label || n.id}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">{n.id}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Shortcuts Cheatsheet */}
        <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-[#0B0F17] p-3 text-[11px] text-slate-500 dark:text-slate-400 space-y-1.5">
          <div className="font-semibold text-slate-700 dark:text-slate-200">效率快捷键</div>
          <div className="flex justify-between"><span>命令面板搜索</span><kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-white/10">Ctrl + K</kbd></div>
          <div className="flex justify-between"><span>保存当前画布</span><kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-white/10">Ctrl + S</kbd></div>
          <div className="flex justify-between"><span>撤销 / 重做</span><kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-white/10">Ctrl + Z / Y</kbd></div>
          <div className="flex justify-between"><span>右键画布/节点</span><span className="font-mono text-[10px]">快捷插入 / 单步调试</span></div>
        </div>
      </div>
    )
  }

  const nodeType = (node.type || 'llm') as SynthNodeType
  const accent = NODE_ACCENT_META[nodeType] || NODE_ACCENT_META.llm
  const upstreamVars = getUpstreamVariables(node.id, nodes, edges)
  const testRes = singleNodeResults[node.id]
  const isTesting = testingNodeId === node.id

  const appendVarToField = (
    fieldKey: 'userPrompt' | 'queryTemplate' | 'sourceTemplate' | 'template' | 'url' | 'itemTemplate',
    token: string,
  ) => {
    const current = String(node.data[fieldKey] || '')
    const sep = current && !current.endsWith(' ') && !current.endsWith('\n') ? ' ' : ''
    updateNodeData(node.id, { [fieldKey]: `${current}${sep}${token}` })
  }

  const renderVarChips = (
    fieldKey: 'userPrompt' | 'queryTemplate' | 'sourceTemplate' | 'template' | 'url' | 'itemTemplate',
  ) => {
    if (upstreamVars.length === 0) return null
    return (
      <div className="mt-1.5">
        <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-violet-400" />
          <span>{t('insertVar')}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {upstreamVars.map((v) => (
            <button
              key={v.token}
              type="button"
              onClick={() => appendVarToField(fieldKey, v.token)}
              className="rounded-md border px-1.5 py-0.5 text-[10px] font-mono hover:brightness-110 transition-all"
              style={{
                borderColor: `${v.color}45`,
                backgroundColor: `${v.color}15`,
                color: v.color,
              }}
            >
              {v.token}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#090C12] px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-violet-500 transition-colors'
  const labelClass = 'block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1'

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Node Header + Single-Node Test Action */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200/80 dark:border-white/[0.08]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: accent.color }} />
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {t(`nodeTypes.${nodeType}`)}
            </div>
            <div className="text-[10px] font-mono text-slate-400">ID: {node.id}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => testNodeIsolated(node.id)}
            disabled={isTesting}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 px-2 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-300 disabled:opacity-50"
          >
            {isTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            <span>{isTesting ? t('testingNode') : t('testSingleNode')}</span>
          </button>
          <button
            onClick={() => duplicateNode(node.id)}
            title={t('duplicate')}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-200"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => deleteNode(node.id)}
            title={t('delete')}
            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-500/15"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Common Title */}
      <div>
        <label className={labelClass}>节点名称 / Node Label</label>
        <input
          value={node.data.label || ''}
          onChange={(e) => updateNodeData(node.id, { label: e.target.value })}
          className={inputClass}
        />
      </div>

      {/* 1. INPUT */}
      {nodeType === 'input' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">输入字段 Schema</span>
            <button
              onClick={() => {
                const fields = [...(node.data.fields || [])]
                fields.push({ name: `field_${fields.length + 1}`, label: `字段 ${fields.length + 1}`, type: 'text' })
                updateNodeData(node.id, { fields })
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-sky-500/15 px-2 py-1 text-[11px] font-semibold text-sky-500 hover:bg-sky-500/25"
            >
              <Plus className="h-3 w-3" />
              <span>{t('addField')}</span>
            </button>
          </div>
          {(node.data.fields || []).map((field: InputFieldSchema, idx: number) => (
            <div key={idx} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#131926] p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={field.name}
                  onChange={(e) => {
                    const next = [...(node.data.fields || [])]
                    next[idx] = { ...field, name: e.target.value.replace(/\s+/g, '_') }
                    updateNodeData(node.id, { fields: next })
                  }}
                  className={`${inputClass} font-mono`}
                />
                <select
                  value={field.type}
                  onChange={(e) => {
                    const next = [...(node.data.fields || [])]
                    next[idx] = { ...field, type: e.target.value as 'text' | 'textarea' }
                    updateNodeData(node.id, { fields: next })
                  }}
                  className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#090C12] px-2 py-1.5 text-xs"
                >
                  <option value="text">Text</option>
                  <option value="textarea">Textarea</option>
                </select>
                <button
                  onClick={() => updateNodeData(node.id, { fields: (node.data.fields || []).filter((_, i) => i !== idx) })}
                  className="p-1 text-slate-400 hover:text-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                value={field.label}
                onChange={(e) => {
                  const next = [...(node.data.fields || [])]
                  next[idx] = { ...field, label: e.target.value }
                  updateNodeData(node.id, { fields: next })
                }}
                className={inputClass}
              />
            </div>
          ))}
        </div>
      )}

      {/* 2. KNOWLEDGE */}
      {nodeType === 'knowledge' && (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>检索查询模板 / Query Template</label>
            <textarea rows={3} value={node.data.queryTemplate || ''} onChange={(e) => updateNodeData(node.id, { queryTemplate: e.target.value })} className={`${inputClass} font-mono`} />
            {renderVarChips('queryTemplate')}
          </div>
          <div>
            <label className={labelClass}>Top-K 切片数 ({node.data.topK || 3})</label>
            <input type="range" min={1} max={6} value={node.data.topK || 3} onChange={(e) => updateNodeData(node.id, { topK: Number(e.target.value) })} className="w-full accent-amber-500" />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>检索文档范围</label>
            {knowledgeDocs.map((doc) => {
              const selectedIds = node.data.docIds || []
              const checked = selectedIds.includes(doc.id)
              return (
                <label key={doc.id} className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 px-2.5 py-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = checked ? selectedIds.filter((i) => i !== doc.id) : [...selectedIds, doc.id]
                      updateNodeData(node.id, { docIds: next })
                    }}
                    className="accent-amber-500"
                  />
                  <span className="truncate">{doc.title}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* 3. LLM AGENT (with Prompt Engineering Booster & Live Token Counter) */}
      {nodeType === 'llm' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Model Override</label>
              <input value={node.data.model || ''} onChange={(e) => updateNodeData(node.id, { model: e.target.value })} className={`${inputClass} font-mono`} />
            </div>
            <div>
              <label className={labelClass}>Temperature ({node.data.temperature ?? 0.7})</label>
              <input type="range" min={0} max={1.5} step={0.1} value={node.data.temperature ?? 0.7} onChange={(e) => updateNodeData(node.id, { temperature: Number(e.target.value) })} className="w-full mt-2 accent-violet-500" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">System Prompt</label>
              <span className="font-mono text-[10px] text-violet-400">
                ~{Math.max(1, Math.round(((node.data.systemPrompt || '').length + (node.data.userPrompt || '').length) / 2.2))} est. tok
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {[
                { label: 'CO-STAR', text: '严格按 Context-Objective-Style-Tone-Audience-Response 框架组织输出，逻辑清晰且数据有据。' },
                { label: 'CoT 思维链', text: '请先拆解核心假设与推理步骤，再给出最终量化结论与行动建议。' },
                { label: '高管简报', text: '使用金字塔原理，结论先行，用 Markdown 对比表格和红黄绿风险标注呈现关键决策点。' },
                { label: '红队挑刺', text: '请扮演严苛的红队审查官，主动指出逻辑漏洞、隐性成本与最坏情况预案。' },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    updateNodeData(node.id, {
                      systemPrompt: `${node.data.systemPrompt ? `${node.data.systemPrompt}\n` : ''}${preset.text}`,
                    })
                  }
                  className="rounded-md border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-medium text-violet-500 dark:text-violet-300"
                >
                  + {preset.label}
                </button>
              ))}
            </div>
            <textarea rows={4} value={node.data.systemPrompt || ''} onChange={(e) => updateNodeData(node.id, { systemPrompt: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>User Prompt Template</label>
            <textarea rows={5} value={node.data.userPrompt || ''} onChange={(e) => updateNodeData(node.id, { userPrompt: e.target.value })} className={`${inputClass} font-mono`} />
            {renderVarChips('userPrompt')}
          </div>
        </div>
      )}

      {/* 11. HITL APPROVAL GATE */}
      {nodeType === 'approval' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-[11px] text-amber-600 dark:text-amber-200 leading-relaxed">
            执行到此节点时，后端异步引擎会自动挂起等待人工介入；审阅者可在演练场在线修改内容后点击放行或驳回。
          </div>
          <div>
            <label className={labelClass}>待审阅上游内容表达式（留空自动读取上游节点）</label>
            <input value={node.data.sourceTemplate || ''} onChange={(e) => updateNodeData(node.id, { sourceTemplate: e.target.value })} className={`${inputClass} font-mono`} />
            {renderVarChips('sourceTemplate')}
          </div>
          <div>
            <label className={labelClass}>给审阅人的提示说明 / Reviewer Instructions</label>
            <textarea rows={3} value={node.data.instructions || ''} onChange={(e) => updateNodeData(node.id, { instructions: e.target.value })} className={inputClass} />
          </div>
        </div>
      )}

      {/* 12. STICKY NOTE ANNOTATION */}
      {nodeType === 'note' && (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>便签颜色</label>
            <div className="flex gap-2">
              {(['amber', 'violet', 'cyan'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => updateNodeData(node.id, { color: c })}
                  className={`rounded-lg px-3 py-1 text-xs font-mono capitalize border ${
                    node.data.color === c ? 'border-white ring-1 ring-violet-500' : 'border-slate-200 dark:border-white/10'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>批注正文</label>
            <textarea rows={5} value={node.data.content || ''} onChange={(e) => updateNodeData(node.id, { content: e.target.value })} className={inputClass} />
          </div>
        </div>
      )}

      {/* 4. CONDITION */}
      {nodeType === 'condition' && (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>判断源表达式</label>
            <input value={node.data.sourceTemplate || ''} onChange={(e) => updateNodeData(node.id, { sourceTemplate: e.target.value })} className={`${inputClass} font-mono`} />
            {renderVarChips('sourceTemplate')}
          </div>
          <div>
            <label className={labelClass}>匹配操作符</label>
            <select
              value={node.data.operator || 'contains_any'}
              onChange={(e) => updateNodeData(node.id, { operator: e.target.value as NonNullable<typeof node.data.operator> })}
              className={inputClass}
            >
              <option value="contains">contains (包含关键词)</option>
              <option value="contains_any">contains_any (命中任一逗号词)</option>
              <option value="not_contains">not_contains (不包含)</option>
              <option value="equals">equals (相等)</option>
              <option value="length_gt">length_gt (长度大于)</option>
              <option value="length_lt">length_lt (长度小于)</option>
              <option value="regex">regex (正则)</option>
              <option value="json_field_equals">json_field_equals (JSON字段=值)</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>匹配目标值</label>
            <input value={node.data.value || ''} onChange={(e) => updateNodeData(node.id, { value: e.target.value })} className={`${inputClass} font-mono`} />
          </div>
        </div>
      )}

      {/* 5. INTENT CLASSIFIER */}
      {nodeType === 'classifier' && (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>待分类文本表达式</label>
            <input value={node.data.sourceTemplate || '{{input}}'} onChange={(e) => updateNodeData(node.id, { sourceTemplate: e.target.value })} className={`${inputClass} font-mono`} />
            {renderVarChips('sourceTemplate')}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-pink-500">意图路由分类列表（动态端口）</span>
            <button
              onClick={() => {
                const cats = [...(node.data.categories || [])]
                cats.push({ id: `intent_${cats.length + 1}`, label: `意图 ${cats.length + 1}`, keywords: '' })
                updateNodeData(node.id, { categories: cats })
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-pink-500/15 px-2 py-1 text-[11px] font-semibold text-pink-500"
            >
              <Plus className="h-3 w-3" /> 添加意图
            </button>
          </div>
          {(node.data.categories || []).map((cat: ClassifierCategory, idx: number) => (
            <div key={idx} className="rounded-xl border border-pink-500/25 bg-pink-500/[0.04] p-2.5 space-y-1.5">
              <div className="flex gap-2">
                <input
                  value={cat.id}
                  onChange={(e) => {
                    const next = [...(node.data.categories || [])]
                    next[idx] = { ...cat, id: e.target.value.replace(/\s+/g, '_') }
                    updateNodeData(node.id, { categories: next })
                  }}
                  placeholder="handle_id"
                  className={`${inputClass} font-mono w-28`}
                />
                <input
                  value={cat.label}
                  onChange={(e) => {
                    const next = [...(node.data.categories || [])]
                    next[idx] = { ...cat, label: e.target.value }
                    updateNodeData(node.id, { categories: next })
                  }}
                  placeholder="显示名称"
                  className={inputClass}
                />
                <button
                  onClick={() => updateNodeData(node.id, { categories: (node.data.categories || []).filter((_, i) => i !== idx) })}
                  className="p-1 text-slate-400 hover:text-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                value={cat.keywords || ''}
                onChange={(e) => {
                  const next = [...(node.data.categories || [])]
                  next[idx] = { ...cat, keywords: e.target.value }
                  updateNodeData(node.id, { categories: next })
                }}
                placeholder="触发关键词（逗号分隔）"
                className={`${inputClass} font-mono text-[11px]`}
              />
            </div>
          ))}
        </div>
      )}

      {/* 6. CODE / TRANSFORM */}
      {nodeType === 'code' && (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>转换模式 / Transform Mode</label>
            <select
              value={node.data.transformMode || 'markdown_summary'}
              onChange={(e) => updateNodeData(node.id, { transformMode: e.target.value as NonNullable<typeof node.data.transformMode> })}
              className={inputClass}
            >
              <option value="markdown_summary">JSON/文本 自动清洗为 Markdown 表格</option>
              <option value="json_extract">JSON Path 精准字段提取</option>
              <option value="expression">AST 安全表达式求值 (word_count / round / data[...])</option>
              <option value="regex_replace">正则表达式清洗替换</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>数据源模板</label>
            <input value={node.data.sourceTemplate || ''} onChange={(e) => updateNodeData(node.id, { sourceTemplate: e.target.value })} className={`${inputClass} font-mono`} />
            {renderVarChips('sourceTemplate')}
          </div>
          {node.data.transformMode === 'json_extract' && (
            <div>
              <label className={labelClass}>JSON Path（如 data.yoy_growth_rate）</label>
              <input value={node.data.jsonPath || ''} onChange={(e) => updateNodeData(node.id, { jsonPath: e.target.value })} className={`${inputClass} font-mono`} />
            </div>
          )}
          {node.data.transformMode === 'expression' && (
            <div>
              <label className={labelClass}>安全表达式（可用 text, data, chars, lines, word_count()）</label>
              <textarea rows={3} value={node.data.expression || ''} onChange={(e) => updateNodeData(node.id, { expression: e.target.value })} className={`${inputClass} font-mono`} />
            </div>
          )}
          {node.data.transformMode === 'regex_replace' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Regex Pattern</label>
                <input value={node.data.regexPattern || ''} onChange={(e) => updateNodeData(node.id, { regexPattern: e.target.value })} className={`${inputClass} font-mono`} />
              </div>
              <div>
                <label className={labelClass}>Replacement</label>
                <input value={node.data.regexReplacement || ''} onChange={(e) => updateNodeData(node.id, { regexReplacement: e.target.value })} className={`${inputClass} font-mono`} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. AGGREGATOR */}
      {nodeType === 'aggregator' && (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>汇聚策略 / Merge Strategy</label>
            <select
              value={node.data.strategy || 'markdown_merge'}
              onChange={(e) => updateNodeData(node.id, { strategy: e.target.value as NonNullable<typeof node.data.strategy> })}
              className={inputClass}
            >
              <option value="markdown_merge">Markdown 全量拼接所有激活分支</option>
              <option value="first_non_empty">取首个命中非空分支（适合意图路由汇聚）</option>
              <option value="json_bundle">打包为结构化 JSON 对象</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>分支分隔符 / Branch Separator</label>
            <select
              value={node.data.separator || '\n\n---\n\n'}
              onChange={(e) => updateNodeData(node.id, { separator: e.target.value })}
              className={inputClass}
            >
              <option value={'\n\n---\n\n'}>Markdown 分割线 (---)</option>
              <option value={'\n\n'}>双换行段落</option>
              <option value={'\n'}>单换行</option>
              <option value={', '}>逗号分隔</option>
            </select>
          </div>
        </div>
      )}

      {/* 8. LOOP / BATCH */}
      {nodeType === 'loop' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className={labelClass}>列表输入源</label>
              <input value={node.data.sourceTemplate || ''} onChange={(e) => updateNodeData(node.id, { sourceTemplate: e.target.value })} className={`${inputClass} font-mono`} />
            </div>
            <div>
              <label className={labelClass}>分隔符</label>
              <input value={node.data.delimiter || ','} onChange={(e) => updateNodeData(node.id, { delimiter: e.target.value })} className={`${inputClass} font-mono`} />
            </div>
          </div>
          <div>
            <label className={labelClass}>单条目渲染模板（支持 {`{{item}}`} 与 {`{{index}}`}）</label>
            <textarea rows={5} value={node.data.itemTemplate || ''} onChange={(e) => updateNodeData(node.id, { itemTemplate: e.target.value })} className={`${inputClass} font-mono`} />
            {renderVarChips('itemTemplate')}
          </div>
        </div>
      )}

      {/* 9. HTTP TOOL */}
      {nodeType === 'http' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-[11px] text-emerald-600 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>公网 HTTPS + 严格 SSRF 内网/元数据拦截防护。</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelClass}>Method</label>
              <select value={node.data.method || 'GET'} onChange={(e) => updateNodeData(node.id, { method: e.target.value as 'GET' | 'POST' })} className={inputClass}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelClass}>HTTPS URL</label>
              <input value={node.data.url || ''} onChange={(e) => updateNodeData(node.id, { url: e.target.value })} className={`${inputClass} font-mono`} />
            </div>
          </div>
          {renderVarChips('url')}
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 p-2.5 text-xs cursor-pointer">
            <input type="checkbox" checked={node.data.sandboxMode !== false} onChange={(e) => updateNodeData(node.id, { sandboxMode: e.target.checked })} className="accent-rose-500" />
            <span>{t('sandboxMode')}</span>
          </label>
        </div>
      )}

      {/* 10. OUTPUT */}
      {nodeType === 'output' && (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>报告标题</label>
            <input value={node.data.title || ''} onChange={(e) => updateNodeData(node.id, { title: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>聚合模板（留空自动拼接上游）</label>
            <textarea rows={5} value={node.data.template || ''} onChange={(e) => updateNodeData(node.id, { template: e.target.value })} className={`${inputClass} font-mono`} />
            {renderVarChips('template')}
          </div>
        </div>
      )}

      {/* Inline Single-Node Debug Output Result */}
      {testRes && (
        <div className="rounded-2xl border border-amber-500/35 bg-amber-500/[0.06] p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="inline-flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              单节点试跑结果 ({testRes.status})
            </span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400">
                {testRes.duration_ms}ms · {testRes.tokens_used} tok
              </span>
              {testRes.output_text && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(testRes.output_text)}
                  title="Copy output"
                  className="rounded p-1 text-slate-500 hover:bg-slate-200/70 dark:hover:bg-white/10"
                >
                  <Copy className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#090C12] p-2.5">
            {testRes.error_message ? (
              <p className="font-mono text-xs text-rose-400">{testRes.error_message}</p>
            ) : (
              <MarkdownViewer content={testRes.output_text || '(Empty)'} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
