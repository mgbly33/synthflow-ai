import { create } from 'zustand'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react'
import { api, streamWorkflowRun } from '../api/client'
import i18n from '../i18n'
import type {
  AnalyticsSummary,
  CopilotBlueprint,
  KnowledgeDoc,
  NodeRuntimeState,
  PendingApprovalGate,
  ProviderConfig,
  SingleNodeTestResult,
  SynthEdge,
  SynthNode,
  SynthNodeData,
  SynthNodeType,
  WorkflowGraph,
  WorkflowItem,
  WorkflowRunDetail,
  WorkflowRunSummary,
  WorkflowVersionItem,
  WorkspaceView,
} from '../types/workflow'
import { computeAutoLayout, createDefaultNode } from '../utils/layout'

interface GraphSnapshot {
  nodes: SynthNode[]
  edges: SynthEdge[]
}

interface StudioState {
  // UI Preferences & Navigation
  workspaceView: WorkspaceView
  theme: 'dark' | 'light'
  language: 'zh' | 'en'
  leftTab: 'nodes' | 'templates' | 'knowledge'
  rightTab: 'inspector' | 'playground'
  leftCollapsed: boolean
  rightCollapsed: boolean
  snapToGrid: boolean
  showMiniMap: boolean
  isHistoryOpen: boolean
  isSettingsOpen: boolean
  isVersionsOpen: boolean
  isCommandOpen: boolean
  isCopilotOpen: boolean
  isReaderOpen: boolean
  isTourOpen: boolean
  toast: { type: 'success' | 'error' | 'info'; message: string } | null

  // HITL & Canvas Replay Scrubber
  pendingApproval: PendingApprovalGate | null
  replayRun: WorkflowRunDetail | null
  replayStep: number
  replayPlaying: boolean

  // Workflows & Canvas
  workflows: WorkflowItem[]
  activeWorkflowId: string | null
  workflowName: string
  nodes: SynthNode[]
  edges: SynthEdge[]
  selectedNodeId: string | null
  isDirty: boolean
  isSaving: boolean
  past: GraphSnapshot[]
  future: GraphSnapshot[]

  // Single-node debug state
  testingNodeId: string | null
  singleNodeResults: Record<string, SingleNodeTestResult>

  // Versions
  versions: WorkflowVersionItem[]
  isLoadingVersions: boolean

  // Knowledge, Analytics & Provider
  knowledgeDocs: KnowledgeDoc[]
  providerConfig: ProviderConfig | null
  analyticsSummary: AnalyticsSummary | null
  isLoadingAnalytics: boolean

  // Live Execution State
  isRunning: boolean
  activeRunId: string | null
  runAbortController: AbortController | null
  runInputs: Record<string, string>
  nodeRuntime: Record<string, NodeRuntimeState>
  activeEdgeIds: string[]
  finalOutput: string
  lastRunStats: { durationMs: number; totalTokens: number; status: string } | null
  runError: string | null

  // History & Trace
  runs: WorkflowRunSummary[]
  selectedRunDetail: WorkflowRunDetail | null
  isLoadingRuns: boolean

  // Actions
  initStudio: () => Promise<void>
  setWorkspaceView: (view: WorkspaceView) => void
  setTheme: (theme: 'dark' | 'light') => void
  toggleTheme: () => void
  setLanguage: (lang: 'zh' | 'en') => void
  setLeftTab: (tab: 'nodes' | 'templates' | 'knowledge') => void
  setRightTab: (tab: 'inspector' | 'playground') => void
  toggleLeftCollapsed: () => void
  toggleRightCollapsed: () => void
  toggleSnapToGrid: () => void
  toggleMiniMap: () => void
  setHistoryOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setVersionsOpen: (open: boolean) => void
  setCommandOpen: (open: boolean) => void
  setCopilotOpen: (open: boolean) => void
  setReaderOpen: (open: boolean) => void
  setTourOpen: (open: boolean) => void
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void

  // Copilot, HITL & Replay actions
  applyCopilotBlueprint: (bp: CopilotBlueprint) => Promise<void>
  optimizeCurrentGraph: () => Promise<void>
  submitApprovalDecision: (approved: boolean, editedOutput?: string, comment?: string) => Promise<void>
  startCanvasReplay: (runDetail: WorkflowRunDetail) => void
  setReplayStep: (step: number) => void
  setReplayPlaying: (playing: boolean) => void
  stopCanvasReplay: () => void

  // Workflow actions
  selectWorkflow: (id: string) => void
  createBlankWorkflow: () => Promise<void>
  cloneWorkflow: (id: string) => Promise<void>
  deleteWorkflow: (id: string) => Promise<void>
  setWorkflowName: (name: string) => void
  saveWorkflow: () => Promise<void>
  importGraphJson: (graph: WorkflowGraph, name?: string) => void

  // Canvas & history actions
  onNodesChange: (changes: NodeChange<SynthNode>[]) => void
  onEdgesChange: (changes: EdgeChange<SynthEdge>[]) => void
  onConnect: (connection: Connection) => void
  selectNode: (nodeId: string | null) => void
  addNode: (type: SynthNodeType, position?: { x: number; y: number }) => void
  duplicateNode: (nodeId: string) => void
  updateNodeData: (nodeId: string, patch: Partial<SynthNodeData>) => void
  deleteNode: (nodeId: string) => void
  deleteEdge: (edgeId: string) => void
  autoLayout: () => void
  undo: () => void
  redo: () => void
  pushHistory: () => void

  // Single-node debug
  testNodeIsolated: (nodeId: string) => Promise<void>

  // Versions
  refreshVersions: () => Promise<void>
  publishVersion: (tag: string, note: string) => Promise<void>
  restoreVersion: (versionId: string) => Promise<void>

  // Knowledge, Analytics & Provider
  refreshKnowledge: () => Promise<void>
  createKnowledgeDoc: (title: string, content: string) => Promise<void>
  updateKnowledgeDoc: (id: string, title: string, content: string) => Promise<void>
  deleteKnowledgeDoc: (id: string) => Promise<void>
  refreshAnalytics: () => Promise<void>
  refreshProviderConfig: () => Promise<void>
  setProviderConfig: (cfg: ProviderConfig) => void

  // Playground & Execution
  setRunInput: (field: string, value: string) => void
  fillSampleInputs: () => void
  startExecution: () => Promise<void>
  stopExecution: () => void
  resetRuntime: () => void

  // History
  refreshRuns: () => Promise<void>
  selectRunDetail: (runId: string) => Promise<void>
  deleteRun: (runId: string) => Promise<void>
}

const cloneGraph = (nodes: SynthNode[], edges: SynthEdge[]): GraphSnapshot => ({
  nodes: JSON.parse(JSON.stringify(nodes)),
  edges: JSON.parse(JSON.stringify(edges)),
})

function extractDefaultInputs(nodes: SynthNode[]): Record<string, string> {
  const inputNode = nodes.find((n) => n.type === 'input')
  if (!inputNode) return {}
  const res: Record<string, string> = {}
  const samples = inputNode.data.sampleInputs || {}
  for (const field of inputNode.data.fields || []) {
    res[field.name] = samples[field.name] ?? field.defaultValue ?? ''
  }
  return res
}

export const useStudioStore = create<StudioState>((set, get) => ({
  workspaceView: 'studio',
  theme: 'dark',
  language: 'zh',
  leftTab: 'templates',
  rightTab: 'playground',
  leftCollapsed: false,
  rightCollapsed: false,
  snapToGrid: true,
  showMiniMap: true,
  isHistoryOpen: false,
  isSettingsOpen: false,
  isVersionsOpen: false,
  isCommandOpen: false,
  isCopilotOpen: false,
  isReaderOpen: false,
  isTourOpen: false,
  toast: null,

  pendingApproval: null,
  replayRun: null,
  replayStep: 0,
  replayPlaying: false,

  workflows: [],
  activeWorkflowId: null,
  workflowName: '',
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isDirty: false,
  isSaving: false,
  past: [],
  future: [],

  testingNodeId: null,
  singleNodeResults: {},

  versions: [],
  isLoadingVersions: false,

  knowledgeDocs: [],
  providerConfig: null,
  analyticsSummary: null,
  isLoadingAnalytics: false,

  isRunning: false,
  activeRunId: null,
  runAbortController: null,
  runInputs: {},
  nodeRuntime: {},
  activeEdgeIds: [],
  finalOutput: '',
  lastRunStats: null,
  runError: null,

  runs: [],
  selectedRunDetail: null,
  isLoadingRuns: false,

  showToast: (message, type = 'info') => {
    set({ toast: { type, message } })
    setTimeout(() => {
      if (get().toast?.message === message) {
        set({ toast: null })
      }
    }, 3200)
  },

  setWorkspaceView: (workspaceView) => {
    set({ workspaceView })
    if (workspaceView === 'analytics') {
      get().refreshAnalytics()
      get().refreshRuns()
    }
  },

  setTheme: (theme) => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    set({ theme })
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    get().setTheme(next)
  },

  setLanguage: (lang) => {
    i18n.changeLanguage(lang)
    set({ language: lang })
  },

  setLeftTab: (leftTab) => set({ leftTab }),
  setRightTab: (rightTab) => set({ rightTab }),
  toggleLeftCollapsed: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
  toggleRightCollapsed: () => set((s) => ({ rightCollapsed: !s.rightCollapsed })),
  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
  toggleMiniMap: () => set((s) => ({ showMiniMap: !s.showMiniMap })),

  setHistoryOpen: (open) => {
    set({ isHistoryOpen: open })
    if (open) get().refreshRuns()
  },
  setSettingsOpen: (open) => {
    set({ isSettingsOpen: open })
    if (open) get().refreshProviderConfig()
  },
  setVersionsOpen: (open) => {
    set({ isVersionsOpen: open })
    if (open) get().refreshVersions()
  },
  setCommandOpen: (isCommandOpen) => set({ isCommandOpen }),
  setCopilotOpen: (isCopilotOpen) => set({ isCopilotOpen }),
  setReaderOpen: (isReaderOpen) => set({ isReaderOpen }),
  setTourOpen: (isTourOpen) => set({ isTourOpen }),

  applyCopilotBlueprint: async (bp) => {
    const created = await api.createWorkflow({
      name: bp.name,
      name_en: bp.name,
      description: bp.description,
      description_en: bp.description,
      category: bp.category || 'custom',
      graph_json: bp.graph_json,
    })
    set((s) => ({ workflows: [created, ...s.workflows], workspaceView: 'studio' }))
    get().selectWorkflow(created.id)
    get().showToast(`AI 架构师已生成并加载「${created.name}」`, 'success')
  },

  optimizeCurrentGraph: async () => {
    const { nodes, edges } = get()
    try {
      const res = await api.copilotOptimize({ nodes, edges })
      get().pushHistory()
      set({
        nodes: res.graph_json.nodes as SynthNode[],
        edges: res.graph_json.edges,
        isDirty: true,
      })
      get().showToast(res.suggestions[0] || '已完成 AI 架构优化', 'success')
    } catch (err) {
      get().showToast((err as Error).message, 'error')
    }
  },

  submitApprovalDecision: async (approved, editedOutput, comment) => {
    const gate = get().pendingApproval
    if (!gate) return
    try {
      await api.approveHitlGate(gate.runId, {
        node_id: gate.nodeId,
        approved,
        edited_output: editedOutput,
        comment: comment || '',
      })
      set({ pendingApproval: null })
      get().showToast(approved ? '已批准放行，工作流继续执行' : '已驳回审批，终止下游执行', approved ? 'success' : 'info')
    } catch (err) {
      get().showToast((err as Error).message, 'error')
    }
  },

  startCanvasReplay: (runDetail) => {
    if (runDetail.workflow_id) {
      get().selectWorkflow(runDetail.workflow_id)
    }
    set({
      workspaceView: 'studio',
      isHistoryOpen: false,
      replayRun: runDetail,
      replayStep: 0,
      replayPlaying: true,
    })
    get().setReplayStep(1)
  },

  setReplayStep: (step) => {
    const run = get().replayRun
    if (!run) return
    const total = run.node_logs.length
    const clamped = Math.max(0, Math.min(total, step))
    const runtime: Record<string, NodeRuntimeState> = {}
    const completedIds = new Set<string>()
    for (let i = 0; i < clamped; i++) {
      const lg = run.node_logs[i]
      const isLast = i === clamped - 1 && clamped < total
      const status =
        lg.status === 'SKIPPED'
          ? 'skipped'
          : lg.status === 'FAILED'
            ? 'error'
            : isLast
              ? 'running'
              : 'completed'
      runtime[lg.node_id] = {
        status,
        output: lg.output_text,
        inputSnapshot: lg.input_snapshot,
        durationMs: lg.duration_ms,
        offsetMs: lg.offset_ms,
        tokensUsed: lg.tokens_used,
        nodeLabel: lg.node_label,
        nodeType: lg.node_type,
      }
      if (status === 'completed') completedIds.add(lg.node_id)
    }
    const activeEdgeIds = get()
      .edges.filter((e) => completedIds.has(e.source))
      .map((e) => e.id)

    set({
      replayStep: clamped,
      nodeRuntime: runtime,
      activeEdgeIds,
      finalOutput: clamped >= total ? run.final_output : '',
      replayPlaying: clamped >= total ? false : get().replayPlaying,
    })
  },

  setReplayPlaying: (replayPlaying) => set({ replayPlaying }),

  stopCanvasReplay: () => {
    set({ replayRun: null, replayStep: 0, replayPlaying: false })
    get().resetRuntime()
  },

  initStudio: async () => {
    document.documentElement.classList.toggle('dark', get().theme === 'dark')
    try {
      const [workflows, knowledgeDocs, providerConfig] = await Promise.all([
        api.listWorkflows(),
        api.listKnowledge(),
        api.getProviderConfig(),
      ])
      set({ workflows, knowledgeDocs, providerConfig })
      if (workflows.length > 0 && !get().activeWorkflowId) {
        get().selectWorkflow(workflows[0].id)
      }
    } catch (err) {
      get().showToast(`API connection failed: ${(err as Error).message}`, 'error')
    }
  },

  selectWorkflow: (id) => {
    const wf = get().workflows.find((w) => w.id === id)
    if (!wf) return
    const activeCtrl = get().runAbortController
    if (activeCtrl) activeCtrl.abort()
    const graphNodes = (wf.graph_json?.nodes || []).map((n) => ({
      ...n,
      type: n.type as SynthNodeType,
    }))
    const graphEdges = (wf.graph_json?.edges || []).map((e) => ({
      ...e,
      type: e.type || 'glow',
    }))
    set({
      activeWorkflowId: wf.id,
      workflowName: wf.name,
      nodes: graphNodes,
      edges: graphEdges,
      selectedNodeId: null,
      rightTab: 'playground',
      isDirty: false,
      isRunning: false,
      runAbortController: null,
      pendingApproval: null,
      replayRun: null,
      replayStep: 0,
      replayPlaying: false,
      past: [],
      future: [],
      runInputs: extractDefaultInputs(graphNodes),
      nodeRuntime: {},
      activeEdgeIds: [],
      finalOutput: '',
      lastRunStats: null,
      runError: null,
      singleNodeResults: {},
    })
  },

  createBlankWorkflow: async () => {
    const inputNode = createDefaultNode('input', { x: 80, y: 180 })
    const llmNode = createDefaultNode('llm', { x: 440, y: 180 })
    const outputNode = createDefaultNode('output', { x: 810, y: 180 })
    outputNode.data.template = `{{${llmNode.id}.output}}`

    const graph: WorkflowGraph = {
      nodes: [inputNode, llmNode, outputNode],
      edges: [
        { id: `e-${inputNode.id}-${llmNode.id}`, source: inputNode.id, target: llmNode.id, type: 'glow' },
        { id: `e-${llmNode.id}-${outputNode.id}`, source: llmNode.id, target: outputNode.id, type: 'glow' },
      ],
    }

    const created = await api.createWorkflow({
      name: get().language === 'en' ? 'Untitled AI Workflow' : '未命名 AI 工作流',
      name_en: 'Untitled AI Workflow',
      description: '自定义可视化 AI 工作流',
      description_en: 'Custom visual AI workflow',
      category: 'custom',
      graph_json: graph,
    })
    set((s) => ({ workflows: [created, ...s.workflows] }))
    get().selectWorkflow(created.id)
    get().showToast(get().language === 'en' ? 'Created blank workflow' : '已新建空白工作流', 'success')
  },

  cloneWorkflow: async (id) => {
    const cloned = await api.cloneWorkflow(id)
    set((s) => ({ workflows: [cloned, ...s.workflows] }))
    get().selectWorkflow(cloned.id)
    get().showToast(get().language === 'en' ? 'Cloned template to custom workflow' : '已克隆模板为自定义工作流', 'success')
  },

  deleteWorkflow: async (id) => {
    await api.deleteWorkflow(id)
    const remaining = get().workflows.filter((w) => w.id !== id)
    set({ workflows: remaining })
    if (get().activeWorkflowId === id) {
      if (remaining.length > 0) {
        get().selectWorkflow(remaining[0].id)
      } else {
        set({ activeWorkflowId: null, nodes: [], edges: [], workflowName: '' })
      }
    }
    get().showToast(get().language === 'en' ? 'Workflow deleted' : '工作流已删除', 'info')
  },

  setWorkflowName: (workflowName) => set({ workflowName, isDirty: true }),

  saveWorkflow: async () => {
    const { activeWorkflowId, workflowName, nodes, edges } = get()
    if (!activeWorkflowId) return
    set({ isSaving: true })
    try {
      const updated = await api.updateWorkflow(activeWorkflowId, {
        name: workflowName.trim() || 'Untitled Workflow',
        graph_json: { nodes, edges },
      })
      set((s) => ({
        workflows: s.workflows.map((w) => (w.id === updated.id ? updated : w)),
        isDirty: false,
        isSaving: false,
      }))
      get().showToast(get().language === 'en' ? 'Workflow saved' : '工作流已保存到数据库', 'success')
    } catch (err) {
      set({ isSaving: false })
      get().showToast((err as Error).message, 'error')
    }
  },

  importGraphJson: (graph, name) => {
    get().pushHistory()
    const importedNodes = (graph.nodes || []).map((n) => ({ ...n, type: n.type as SynthNodeType }))
    const importedEdges = (graph.edges || []).map((e) => ({ ...e, type: e.type || 'glow' }))
    set({
      nodes: importedNodes,
      edges: importedEdges,
      workflowName: name || get().workflowName,
      isDirty: true,
      runInputs: extractDefaultInputs(importedNodes),
    })
    get().showToast(get().language === 'en' ? 'Workflow JSON imported' : 'JSON 工作流导入成功', 'success')
  },

  pushHistory: () => {
    const { nodes, edges, past } = get()
    set({ past: [...past.slice(-29), cloneGraph(nodes, edges)], future: [] })
  },

  onNodesChange: (changes) => {
    if (changes.some((c) => c.type === 'remove')) get().pushHistory()
    set((s) => ({
      nodes: applyNodeChanges(changes, s.nodes) as SynthNode[],
      isDirty: s.isDirty || changes.some((c) => c.type !== 'select' && c.type !== 'dimensions'),
    }))
  },

  onEdgesChange: (changes) => {
    if (changes.some((c) => c.type === 'remove')) get().pushHistory()
    set((s) => ({
      edges: applyEdgeChanges(changes, s.edges),
      isDirty: s.isDirty || changes.some((c) => c.type !== 'select'),
    }))
  },

  onConnect: (connection) => {
    get().pushHistory()
    const srcNode = get().nodes.find((n) => n.id === connection.source)
    let label: string | undefined
    if (connection.sourceHandle === 'true') label = 'True'
    else if (connection.sourceHandle === 'false') label = 'False'
    else if (srcNode?.type === 'classifier' && connection.sourceHandle) {
      const cat = (srcNode.data.categories || []).find((c) => c.id === connection.sourceHandle)
      label = cat?.label || connection.sourceHandle
    }

    set((s) => ({
      edges: addEdge(
        {
          ...connection,
          id: `e-${connection.source}-${connection.sourceHandle || 'out'}-${connection.target}-${Date.now().toString(36)}`,
          type: 'glow',
          label,
        },
        s.edges,
      ),
      isDirty: true,
    }))
  },

  selectNode: (nodeId) => {
    set({
      selectedNodeId: nodeId,
      rightTab: nodeId ? 'inspector' : get().rightTab,
    })
  },

  addNode: (type, position) => {
    get().pushHistory()
    const existingCount = get().nodes.length
    const pos = position || {
      x: 180 + (existingCount % 4) * 280,
      y: 120 + Math.floor(existingCount / 4) * 200,
    }
    const node = createDefaultNode(type, pos)
    set((s) => ({
      nodes: [...s.nodes, node],
      selectedNodeId: node.id,
      rightTab: 'inspector',
      isDirty: true,
    }))
  },

  duplicateNode: (nodeId) => {
    const src = get().nodes.find((n) => n.id === nodeId)
    if (!src) return
    get().pushHistory()
    const copyId = `${src.type}_${Math.random().toString(36).slice(2, 6)}`
    const copy: SynthNode = {
      ...JSON.parse(JSON.stringify(src)),
      id: copyId,
      position: { x: src.position.x + 48, y: src.position.y + 48 },
      selected: true,
    }
    copy.data.label = `${copy.data.label || src.id} (Copy)`
    set((s) => ({
      nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), copy],
      selectedNodeId: copy.id,
      rightTab: 'inspector',
      isDirty: true,
    }))
    get().showToast(get().language === 'en' ? 'Node duplicated' : '已复制节点', 'info')
  },

  updateNodeData: (nodeId, patch) => {
    set((s) => {
      const nextNodes = s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n,
      )
      const isInputNode = nextNodes.find((n) => n.id === nodeId)?.type === 'input'
      return {
        nodes: nextNodes,
        isDirty: true,
        ...(isInputNode ? { runInputs: { ...extractDefaultInputs(nextNodes), ...s.runInputs } } : {}),
      }
    })
  },

  deleteNode: (nodeId) => {
    get().pushHistory()
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
      isDirty: true,
    }))
  },

  deleteEdge: (edgeId) => {
    get().pushHistory()
    set((s) => ({
      edges: s.edges.filter((e) => e.id !== edgeId),
      isDirty: true,
    }))
  },

  autoLayout: () => {
    get().pushHistory()
    set((s) => ({
      nodes: computeAutoLayout(s.nodes, s.edges),
      isDirty: true,
    }))
  },

  undo: () => {
    const { past, nodes, edges, future } = get()
    if (past.length === 0) return
    const prev = past[past.length - 1]
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      past: past.slice(0, -1),
      future: [cloneGraph(nodes, edges), ...future.slice(0, 29)],
      isDirty: true,
    })
  },

  redo: () => {
    const { future, nodes, edges, past } = get()
    if (future.length === 0) return
    const next = future[0]
    set({
      nodes: next.nodes,
      edges: next.edges,
      future: future.slice(1),
      past: [...past, cloneGraph(nodes, edges)],
      isDirty: true,
    })
  },

  testNodeIsolated: async (nodeId) => {
    const { activeWorkflowId, nodes, runInputs, nodeRuntime, language } = get()
    const node = nodes.find((n) => n.id === nodeId)
    if (!activeWorkflowId || !node) return

    set({ testingNodeId: nodeId, selectedNodeId: nodeId, rightTab: 'inspector' })
    const upstreamOutputs: Record<string, string> = {}
    for (const [nid, st] of Object.entries(nodeRuntime)) {
      if (st.output) upstreamOutputs[nid] = st.output
    }

    try {
      const res = await api.testSingleNode(activeWorkflowId, {
        node,
        inputs: runInputs,
        upstream_outputs: upstreamOutputs,
        language,
      })
      set((s) => ({
        testingNodeId: null,
        singleNodeResults: { ...s.singleNodeResults, [nodeId]: res },
        nodeRuntime: {
          ...s.nodeRuntime,
          [nodeId]: {
            status: res.status === 'COMPLETED' ? 'completed' : 'error',
            output: res.output_text,
            inputSnapshot: res.input_snapshot,
            durationMs: res.duration_ms,
            tokensUsed: res.tokens_used,
            error: res.error_message || undefined,
            nodeLabel: node.data.label || node.id,
            nodeType: node.type,
          },
        },
      }))
      get().showToast(
        res.status === 'COMPLETED'
          ? `单节点试跑成功 (${res.duration_ms}ms)`
          : `试跑失败: ${res.error_message}`,
        res.status === 'COMPLETED' ? 'success' : 'error',
      )
    } catch (err) {
      set({ testingNodeId: null })
      get().showToast((err as Error).message, 'error')
    }
  },

  refreshVersions: async () => {
    const wfId = get().activeWorkflowId
    if (!wfId) return
    set({ isLoadingVersions: true })
    try {
      const versions = await api.listVersions(wfId)
      set({ versions, isLoadingVersions: false })
    } catch {
      set({ isLoadingVersions: false })
    }
  },

  publishVersion: async (tag, note) => {
    const { activeWorkflowId, nodes, edges } = get()
    if (!activeWorkflowId) return
    const ver = await api.createVersion(activeWorkflowId, {
      tag,
      note,
      graph_override: { nodes, edges },
    })
    set((s) => ({ versions: [ver, ...s.versions] }))
    get().showToast(`已发布版本快照 ${ver.tag}`, 'success')
  },

  restoreVersion: async (versionId) => {
    const wfId = get().activeWorkflowId
    if (!wfId) return
    const updated = await api.restoreVersion(wfId, versionId)
    set((s) => ({
      workflows: s.workflows.map((w) => (w.id === updated.id ? updated : w)),
    }))
    get().selectWorkflow(updated.id)
    set({ isVersionsOpen: false })
    get().showToast('已回滚至所选历史版本快照', 'success')
  },

  refreshKnowledge: async () => {
    const docs = await api.listKnowledge()
    set({ knowledgeDocs: docs })
  },

  createKnowledgeDoc: async (title, content) => {
    const doc = await api.createKnowledge({ title, content })
    set((s) => ({ knowledgeDocs: [doc, ...s.knowledgeDocs] }))
    get().showToast(get().language === 'en' ? 'Knowledge doc added' : '知识库文档已创建并完成分片', 'success')
  },

  updateKnowledgeDoc: async (id, title, content) => {
    const doc = await api.updateKnowledge(id, { title, content })
    set((s) => ({
      knowledgeDocs: s.knowledgeDocs.map((d) => (d.id === id ? doc : d)),
    }))
    get().showToast(get().language === 'en' ? 'Knowledge doc updated' : '知识库文档已更新', 'success')
  },

  deleteKnowledgeDoc: async (id) => {
    await api.deleteKnowledge(id)
    set((s) => ({
      knowledgeDocs: s.knowledgeDocs.filter((d) => d.id !== id),
    }))
    get().showToast(get().language === 'en' ? 'Document deleted' : '文档已删除', 'info')
  },

  refreshAnalytics: async () => {
    set({ isLoadingAnalytics: true })
    try {
      const analyticsSummary = await api.getAnalyticsSummary()
      set({ analyticsSummary, isLoadingAnalytics: false })
    } catch {
      set({ isLoadingAnalytics: false })
    }
  },

  refreshProviderConfig: async () => {
    const cfg = await api.getProviderConfig()
    set({ providerConfig: cfg })
  },

  setProviderConfig: (providerConfig) => set({ providerConfig }),

  setRunInput: (field, value) =>
    set((s) => ({
      runInputs: { ...s.runInputs, [field]: value },
    })),

  fillSampleInputs: () => {
    const inputNode = get().nodes.find((n) => n.type === 'input')
    if (!inputNode) return
    const samples = inputNode.data.sampleInputs || {}
    const next: Record<string, string> = { ...get().runInputs }
    for (const f of inputNode.data.fields || []) {
      if (samples[f.name] !== undefined) next[f.name] = samples[f.name]
    }
    set({ runInputs: next })
  },

  resetRuntime: () =>
    set({
      nodeRuntime: {},
      activeEdgeIds: [],
      finalOutput: '',
      lastRunStats: null,
      runError: null,
      singleNodeResults: {},
    }),

  stopExecution: () => {
    const ctrl = get().runAbortController
    if (ctrl) ctrl.abort()
    set({ isRunning: false, runAbortController: null, pendingApproval: null })
    get().showToast(get().language === 'en' ? 'Execution stopped' : '已优雅终止当前流式运行', 'info')
  },

  startExecution: async () => {
    const { activeWorkflowId, nodes, edges, runInputs, language, isRunning } = get()
    if (!activeWorkflowId || isRunning) return

    const controller = new AbortController()
    const initialRuntime: Record<string, NodeRuntimeState> = {}
    for (const n of nodes) {
      initialRuntime[n.id] = {
        status: 'idle',
        output: '',
        nodeLabel: (language === 'en' && n.data.labelEn ? n.data.labelEn : n.data.label) || n.id,
        nodeType: n.type,
      }
    }

    set({
      rightTab: 'playground',
      isRunning: true,
      runAbortController: controller,
      nodeRuntime: initialRuntime,
      activeEdgeIds: [],
      finalOutput: '',
      lastRunStats: null,
      runError: null,
      pendingApproval: null,
    })

    try {
      await streamWorkflowRun({
        workflowId: activeWorkflowId,
        inputs: runInputs,
        graphOverride: { nodes, edges },
        language,
        signal: controller.signal,
        onEvent: (evt) => {
          const d = evt.data
          if (evt.event === 'run_started') {
            set({ activeRunId: String(d.run_id || '') })
          } else if (evt.event === 'node_started') {
            const nid = String(d.node_id)
            set((s) => ({
              nodeRuntime: {
                ...s.nodeRuntime,
                [nid]: {
                  ...(s.nodeRuntime[nid] || { output: '' }),
                  status: 'running',
                  output: '',
                  nodeLabel: String(d.node_label || nid),
                  nodeType: String(d.node_type || 'llm'),
                  offsetMs: Number(d.offset_ms || 0),
                },
              },
            }))
          } else if (evt.event === 'node_token') {
            const nid = String(d.node_id)
            const token = String(d.token || '')
            set((s) => ({
              nodeRuntime: {
                ...s.nodeRuntime,
                [nid]: {
                  ...(s.nodeRuntime[nid] || { status: 'running', output: '' }),
                  status: 'running',
                  output: (s.nodeRuntime[nid]?.output || '') + token,
                },
              },
            }))
          } else if (evt.event === 'node_waiting_approval') {
            const nid = String(d.node_id)
            set((s) => ({
              nodeRuntime: {
                ...s.nodeRuntime,
                [nid]: {
                  ...(s.nodeRuntime[nid] || { output: '' }),
                  status: 'waiting_approval',
                  output: String(d.pending_output || ''),
                  nodeLabel: String(d.node_label || nid),
                  nodeType: 'approval',
                },
              },
              pendingApproval: {
                runId: String(d.run_id || s.activeRunId || ''),
                nodeId: nid,
                nodeLabel: String(d.node_label || nid),
                instructions: String(d.instructions || ''),
                pendingOutput: String(d.pending_output || ''),
              },
            }))
          } else if (evt.event === 'node_completed') {
            const nid = String(d.node_id)
            const newEdges = Array.isArray(d.activated_edges) ? (d.activated_edges as string[]) : []
            set((s) => ({
              nodeRuntime: {
                ...s.nodeRuntime,
                [nid]: {
                  ...(s.nodeRuntime[nid] || {}),
                  status: 'completed',
                  output: String(d.output_text || s.nodeRuntime[nid]?.output || ''),
                  inputSnapshot: String(d.input_snapshot || ''),
                  durationMs: Number(d.duration_ms || 0),
                  offsetMs: Number(d.offset_ms || 0),
                  tokensUsed: Number(d.tokens_used || 0),
                  nodeLabel: String(d.node_label || nid),
                  nodeType: String(d.node_type || 'llm'),
                },
              },
              activeEdgeIds: Array.from(new Set([...s.activeEdgeIds, ...newEdges])),
            }))
          } else if (evt.event === 'node_skipped') {
            const nid = String(d.node_id)
            set((s) => ({
              nodeRuntime: {
                ...s.nodeRuntime,
                [nid]: {
                  ...(s.nodeRuntime[nid] || { output: '' }),
                  status: 'skipped',
                  durationMs: 0,
                  nodeLabel: String(d.node_label || nid),
                  nodeType: String(d.node_type || 'llm'),
                },
              },
            }))
          } else if (evt.event === 'node_error') {
            const nid = String(d.node_id)
            set((s) => ({
              nodeRuntime: {
                ...s.nodeRuntime,
                [nid]: {
                  ...(s.nodeRuntime[nid] || { output: '' }),
                  status: 'error',
                  error: String(d.error || 'Unknown error'),
                  durationMs: Number(d.duration_ms || 0),
                },
              },
              runError: String(d.error || 'Node execution failed'),
            }))
          } else if (evt.event === 'run_completed') {
            set({
              finalOutput: String(d.final_output || ''),
              lastRunStats: {
                durationMs: Number(d.total_duration_ms || 0),
                totalTokens: Number(d.total_tokens || 0),
                status: String(d.status || 'COMPLETED'),
              },
              isRunning: false,
              runAbortController: null,
              pendingApproval: null,
            })
            get().refreshRuns()
          } else if (evt.event === 'run_error') {
            set({
              runError: String(d.error || 'Workflow execution failed'),
              isRunning: false,
              runAbortController: null,
            })
          }
        },
      })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const msg = (err as Error).message
        set({ runError: msg })
        get().showToast(msg, 'error')
      }
    } finally {
      set({ isRunning: false, runAbortController: null })
    }
  },

  refreshRuns: async () => {
    set({ isLoadingRuns: true })
    try {
      const runs = await api.listRuns()
      set({ runs, isLoadingRuns: false })
      if (runs.length > 0 && !get().selectedRunDetail) {
        get().selectRunDetail(runs[0].id)
      }
    } catch {
      set({ isLoadingRuns: false })
    }
  },

  selectRunDetail: async (runId) => {
    const detail = await api.getRunDetail(runId)
    set({ selectedRunDetail: detail })
  },

  deleteRun: async (runId) => {
    await api.deleteRun(runId)
    set((s) => ({
      runs: s.runs.filter((r) => r.id !== runId),
      selectedRunDetail: s.selectedRunDetail?.id === runId ? null : s.selectedRunDetail,
    }))
  },
}))
