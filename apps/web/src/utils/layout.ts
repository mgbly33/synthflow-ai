import type { SynthEdge, SynthNode, SynthNodeData, SynthNodeType } from '../types/workflow'

export const NODE_ACCENT_META: Record<
  SynthNodeType,
  { color: string; bgGlow: string; ring: string; gradient: string; label: string }
> = {
  input: {
    color: '#0EA5E9',
    bgGlow: 'rgba(14, 165, 233, 0.35)',
    ring: 'rgba(14, 165, 233, 0.22)',
    gradient: 'from-sky-500 to-cyan-400',
    label: 'INPUT',
  },
  knowledge: {
    color: '#F59E0B',
    bgGlow: 'rgba(245, 158, 11, 0.35)',
    ring: 'rgba(245, 158, 11, 0.22)',
    gradient: 'from-amber-500 to-yellow-400',
    label: 'RAG',
  },
  llm: {
    color: '#8B5CF6',
    bgGlow: 'rgba(139, 92, 246, 0.42)',
    ring: 'rgba(139, 92, 246, 0.24)',
    gradient: 'from-violet-600 to-fuchsia-500',
    label: 'AGENT',
  },
  condition: {
    color: '#10B981',
    bgGlow: 'rgba(16, 185, 129, 0.35)',
    ring: 'rgba(16, 185, 129, 0.22)',
    gradient: 'from-emerald-500 to-teal-400',
    label: 'IF/ELSE',
  },
  classifier: {
    color: '#EC4899',
    bgGlow: 'rgba(236, 72, 153, 0.38)',
    ring: 'rgba(236, 72, 153, 0.22)',
    gradient: 'from-pink-500 to-rose-400',
    label: 'INTENT',
  },
  http: {
    color: '#F43F5E',
    bgGlow: 'rgba(244, 63, 94, 0.35)',
    ring: 'rgba(244, 63, 94, 0.22)',
    gradient: 'from-rose-500 to-orange-400',
    label: 'HTTP',
  },
  code: {
    color: '#06B6D4',
    bgGlow: 'rgba(6, 182, 212, 0.38)',
    ring: 'rgba(6, 182, 212, 0.22)',
    gradient: 'from-cyan-500 to-sky-400',
    label: 'CODE',
  },
  aggregator: {
    color: '#14B8A6',
    bgGlow: 'rgba(20, 184, 166, 0.35)',
    ring: 'rgba(20, 184, 166, 0.22)',
    gradient: 'from-teal-500 to-emerald-400',
    label: 'MERGE',
  },
  loop: {
    color: '#F97316',
    bgGlow: 'rgba(249, 115, 22, 0.38)',
    ring: 'rgba(249, 115, 22, 0.22)',
    gradient: 'from-orange-500 to-amber-400',
    label: 'BATCH',
  },
  approval: {
    color: '#EAB308',
    bgGlow: 'rgba(234, 179, 8, 0.42)',
    ring: 'rgba(234, 179, 8, 0.26)',
    gradient: 'from-yellow-500 to-amber-500',
    label: 'HITL GATE',
  },
  note: {
    color: '#94A3B8',
    bgGlow: 'rgba(148, 163, 184, 0.2)',
    ring: 'rgba(148, 163, 184, 0.15)',
    gradient: 'from-slate-500 to-slate-400',
    label: 'NOTE',
  },
  output: {
    color: '#6366F1',
    bgGlow: 'rgba(99, 102, 241, 0.38)',
    ring: 'rgba(99, 102, 241, 0.22)',
    gradient: 'from-indigo-500 to-violet-500',
    label: 'OUTPUT',
  },
}

export function createDefaultNode(type: SynthNodeType, position: { x: number; y: number }): SynthNode {
  const shortId = `${type}_${Math.random().toString(36).slice(2, 6)}`
  const defaults: Record<SynthNodeType, SynthNodeData> = {
    input: {
      label: '工作流输入',
      labelEn: 'Workflow Input',
      fields: [
        {
          name: 'topic',
          label: '核心主题',
          labelEn: 'Topic',
          type: 'text',
          placeholder: '输入需要处理的主题或需求...',
          required: true,
        },
      ],
      sampleInputs: { topic: '企业级 AI 智能体工作流落地实践' },
    },
    knowledge: {
      label: '知识库检索',
      labelEn: 'Knowledge Retrieval',
      queryTemplate: '{{input.topic}}',
      topK: 3,
      docIds: [],
    },
    llm: {
      label: 'LLM 智能体',
      labelEn: 'LLM Agent',
      role: 'general',
      model: 'deepseek-chat',
      temperature: 0.7,
      systemPrompt: '你是一位严谨专业的 AI 分析专家，请输出结构清晰、可直接落地的 Markdown 内容。',
      userPrompt: '请围绕以下输入展开深度分析：\n{{input}}',
    },
    condition: {
      label: '条件路由器',
      labelEn: 'Condition Router',
      sourceTemplate: '{{input}}',
      operator: 'contains_any',
      value: 'HIGH_RISK,高风险,紧急',
      caseSensitive: false,
      trueLabel: '命中 True',
      falseLabel: '未命中 False',
    },
    classifier: {
      label: '意图分类路由器',
      labelEn: 'Intent Classifier',
      sourceTemplate: '{{input}}',
      categories: [
        { id: 'tech', label: '技术支持', keywords: '500,504,api,bug,报错,故障' },
        { id: 'sales', label: '商务报价', keywords: '报价,价格,采购,企业版,demo' },
        { id: 'refund', label: '退款关怀', keywords: '退款,退订,投诉,取消' },
      ],
    },
    http: {
      label: '外部 HTTP 工具',
      labelEn: 'HTTP Webhook Tool',
      method: 'GET',
      url: 'https://api.example.com/v1/market-snapshot',
      headers: {},
      bodyTemplate: '',
      sandboxMode: true,
    },
    code: {
      label: '代码数据转换',
      labelEn: 'Code Transform',
      transformMode: 'markdown_summary',
      sourceTemplate: '{{input}}',
      expression: 'word_count(text)',
      jsonPath: 'data',
    },
    aggregator: {
      label: '多路聚合器',
      labelEn: 'Branch Aggregator',
      strategy: 'markdown_merge',
      separator: '\n\n---\n\n',
    },
    loop: {
      label: '批量循环迭代',
      labelEn: 'Batch Iterator',
      sourceTemplate: '{{input.topic}}',
      delimiter: ',',
      itemTemplate: '### 条目 #{{index}} · {{item}}\n- 已完成批量结构化处理',
    },
    approval: {
      label: '人工审批门控 (HITL)',
      labelEn: 'Human Approval Gate',
      sourceTemplate: '',
      instructions: '执行至此将暂停等待人工复核，支持在线编辑上游产出并决定放行或驳回。',
    },
    note: {
      label: '架构批注便签',
      labelEn: 'Architecture Note',
      content: '在此记录节点设计意图、业务规则或团队协作说明（不参与 DAG 执行）。',
      color: 'amber',
    },
    output: {
      label: 'Markdown 输出',
      labelEn: 'Final Output',
      title: '工作流最终报告',
      template: '',
      format: 'markdown',
    },
  }

  return {
    id: shortId,
    type,
    position,
    data: defaults[type],
  }
}

export function computeAutoLayout(nodes: SynthNode[], edges: SynthEdge[]): SynthNode[] {
  const execNodes = nodes.filter((n) => n.type !== 'note')
  if (execNodes.length === 0) return nodes

  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const n of execNodes) {
    inDegree.set(n.id, 0)
    adj.set(n.id, [])
  }
  for (const e of edges) {
    if (adj.has(e.source) && inDegree.has(e.target)) {
      adj.get(e.source)!.push(e.target)
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1)
    }
  }

  const layers: string[][] = []
  const visited = new Set<string>()
  let frontier = execNodes.filter((n) => (inDegree.get(n.id) || 0) === 0).map((n) => n.id)

  while (frontier.length > 0) {
    layers.push(frontier)
    const nextFrontier: string[] = []
    for (const id of frontier) {
      visited.add(id)
      for (const nxt of adj.get(id) || []) {
        const deg = (inDegree.get(nxt) || 1) - 1
        inDegree.set(nxt, deg)
        if (deg === 0 && !visited.has(nxt)) nextFrontier.push(nxt)
      }
    }
    frontier = nextFrontier
  }

  const leftovers = execNodes.filter((n) => !visited.has(n.id)).map((n) => n.id)
  if (leftovers.length > 0) layers.push(leftovers)

  const colSpacing = 360
  const rowSpacing = 225
  const posMap = new Map<string, { x: number; y: number }>()

  layers.forEach((layer, colIdx) => {
    const totalHeight = (layer.length - 1) * rowSpacing
    const startY = Math.max(40, 230 - totalHeight / 2)
    layer.forEach((nid, rowIdx) => {
      posMap.set(nid, {
        x: 60 + colIdx * colSpacing,
        y: Math.round(startY + rowIdx * rowSpacing),
      })
    })
  })

  return nodes.map((n) => ({
    ...n,
    position: posMap.get(n.id) || n.position,
  }))
}

export function validateGraphClient(nodes: SynthNode[], edges: SynthEdge[]): {
  valid: boolean
  errors: string[]
  layerCount: number
} {
  const execNodes = nodes.filter((n) => n.type !== 'note')
  const errors: string[] = []
  if (execNodes.length === 0) return { valid: false, errors: ['Empty canvas'], layerCount: 0 }
  if (!execNodes.some((n) => n.type === 'input')) {
    errors.push('Missing Input node')
  }
  const nodeIds = new Set(execNodes.map((n) => n.id))
  const inDeg = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const n of execNodes) {
    inDeg.set(n.id, 0)
    adj.set(n.id, [])
  }
  for (const e of edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue
    if (e.source === e.target) {
      errors.push(`Self-loop on ${e.source}`)
      continue
    }
    adj.get(e.source)!.push(e.target)
    inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1)
  }

  let frontier = execNodes.filter((n) => (inDeg.get(n.id) || 0) === 0).map((n) => n.id)
  let visited = 0
  let layers = 0
  while (frontier.length > 0) {
    layers += 1
    const next: string[] = []
    for (const id of frontier) {
      visited += 1
      for (const nxt of adj.get(id) || []) {
        const d = (inDeg.get(nxt) || 1) - 1
        inDeg.set(nxt, d)
        if (d === 0) next.push(nxt)
      }
    }
    frontier = next
  }
  if (visited < execNodes.length) {
    errors.push('Cycle detected in DAG')
  }
  return { valid: errors.length === 0, errors, layerCount: layers }
}

/**
 * Compute upstream ancestors + downstream descendants for Data Lineage Highlighting.
 */
export function computeDataLineage(nodeId: string | null, edges: SynthEdge[]): Set<string> | null {
  if (!nodeId) return null
  const fwd = new Map<string, string[]>()
  const rev = new Map<string, string[]>()
  for (const e of edges) {
    fwd.set(e.source, [...(fwd.get(e.source) || []), e.target])
    rev.set(e.target, [...(rev.get(e.target) || []), e.source])
  }
  const related = new Set<string>([nodeId])
  const walk = (adj: Map<string, string[]>) => {
    const stack = [nodeId]
    while (stack.length > 0) {
      const cur = stack.pop()!
      for (const nxt of adj.get(cur) || []) {
        if (!related.has(nxt)) {
          related.add(nxt)
          stack.push(nxt)
        }
      }
    }
  }
  walk(fwd)
  walk(rev)
  return related
}

/**
 * Export the visual DAG cleanly to a Mermaid flowchart LR diagram.
 */
export function exportGraphToMermaid(nodes: SynthNode[], edges: SynthEdge[]): string {
  const execNodes = nodes.filter((n) => n.type !== 'note')
  const lines = ['flowchart LR']
  for (const n of execNodes) {
    const cleanId = n.id.replace(/[^a-zA-Z0-9_]/g, '_')
    const label = String(n.data.label || n.id).replace(/"/g, "'")
    const tag = NODE_ACCENT_META[(n.type || 'llm') as SynthNodeType]?.label || 'NODE'
    lines.push(`    ${cleanId}["[${tag}] ${label}"]`)
  }
  for (const e of edges) {
    const s = e.source.replace(/[^a-zA-Z0-9_]/g, '_')
    const t = e.target.replace(/[^a-zA-Z0-9_]/g, '_')
    if (e.label) {
      lines.push(`    ${s} -->|${String(e.label).replace(/\|/g, '/')}| ${t}`)
    } else {
      lines.push(`    ${s} --> ${t}`)
    }
  }
  return lines.join('\n')
}

export function getUpstreamVariables(
  targetNodeId: string,
  nodes: SynthNode[],
  edges: SynthEdge[],
): Array<{ token: string; label: string; color: string }> {
  const reverseAdj = new Map<string, string[]>()
  for (const e of edges) {
    const list = reverseAdj.get(e.target) || []
    list.push(e.source)
    reverseAdj.set(e.target, list)
  }

  const ancestors = new Set<string>()
  const stack = [...(reverseAdj.get(targetNodeId) || [])]
  while (stack.length > 0) {
    const cur = stack.pop()!
    if (ancestors.has(cur)) continue
    ancestors.add(cur)
    for (const prev of reverseAdj.get(cur) || []) {
      if (!ancestors.has(prev)) stack.push(prev)
    }
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const chips: Array<{ token: string; label: string; color: string }> = []

  for (const n of nodes) {
    if (n.type === 'input' && n.id !== targetNodeId) {
      for (const f of n.data.fields || []) {
        if (f.name) {
          chips.push({
            token: `{{input.${f.name}}}`,
            label: `input.${f.name}`,
            color: NODE_ACCENT_META.input.color,
          })
        }
      }
    }
  }

  for (const aid of ancestors) {
    const n = nodeMap.get(aid)
    if (!n || n.type === 'input' || n.type === 'note') continue
    const nType = (n.type || 'llm') as SynthNodeType
    chips.push({
      token: `{{${n.id}.output}}`,
      label: `${n.data.label || n.id}.output`,
      color: NODE_ACCENT_META[nType]?.color || '#8B5CF6',
    })
  }

  return chips
}
