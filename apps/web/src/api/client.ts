import type {
  AnalyticsSummary,
  ArenaComparisonResult,
  CopilotBlueprint,
  EvalAssertionRule,
  EvalCaseItem,
  EvalRunReport,
  KnowledgeDoc,
  KnowledgeSearchResponse,
  ProviderConfig,
  ProviderTestResult,
  ScheduleItem,
  SingleNodeTestResult,
  SynthNode,
  WorkflowGraph,
  WorkflowItem,
  WorkflowRunDetail,
  WorkflowRunSummary,
  WorkflowVersionItem,
} from '../types/workflow'

const API_BASE = '/api'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  })
  if (!resp.ok) {
    let message = `HTTP ${resp.status}`
    try {
      const errData = await resp.json()
      if (typeof errData?.detail === 'string') {
        message = errData.detail
      } else if (errData?.detail?.message) {
        message = errData.detail.message
      } else if (Array.isArray(errData?.detail?.errors)) {
        message = errData.detail.errors.join('; ')
      }
    } catch {
      message = (await resp.text()) || message
    }
    throw new Error(message)
  }
  if (resp.status === 204) {
    return undefined as T
  }
  return resp.json() as Promise<T>
}

export const api = {
  // Workflows
  listWorkflows: () => apiFetch<WorkflowItem[]>('/workflows'),
  getWorkflow: (id: string) => apiFetch<WorkflowItem>(`/workflows/${id}`),
  createWorkflow: (payload: {
    name: string
    name_en?: string
    description?: string
    description_en?: string
    category?: string
    graph_json: WorkflowGraph
  }) => apiFetch<WorkflowItem>('/workflows', { method: 'POST', body: JSON.stringify(payload) }),
  cloneWorkflow: (id: string) => apiFetch<WorkflowItem>(`/workflows/${id}/clone`, { method: 'POST' }),
  updateWorkflow: (
    id: string,
    payload: Partial<{
      name: string
      name_en: string
      description: string
      description_en: string
      category: string
      graph_json: WorkflowGraph
    }>,
  ) => apiFetch<WorkflowItem>(`/workflows/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteWorkflow: (id: string) => apiFetch<void>(`/workflows/${id}`, { method: 'DELETE' }),

  // Versions
  listVersions: (workflowId: string) =>
    apiFetch<WorkflowVersionItem[]>(`/workflows/${workflowId}/versions`),
  createVersion: (
    workflowId: string,
    payload: { tag?: string; note?: string; graph_override?: WorkflowGraph },
  ) =>
    apiFetch<WorkflowVersionItem>(`/workflows/${workflowId}/versions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  restoreVersion: (workflowId: string, versionId: string) =>
    apiFetch<WorkflowItem>(`/workflows/${workflowId}/versions/${versionId}/restore`, {
      method: 'POST',
    }),

  // Single-node isolated debug runner
  testSingleNode: (
    workflowId: string,
    payload: {
      node: SynthNode
      inputs: Record<string, unknown>
      upstream_outputs: Record<string, string>
      language: 'zh' | 'en'
    },
  ) =>
    apiFetch<SingleNodeTestResult>(`/workflows/${workflowId}/nodes/test`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // AI Copilot & Graph Optimizer
  copilotGenerate: (payload: { prompt: string; language: 'zh' | 'en'; save_as_workflow?: boolean }) =>
    apiFetch<CopilotBlueprint>('/copilot/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  copilotOptimize: (graph_json: WorkflowGraph) =>
    apiFetch<{ suggestions: string[]; graph_json: WorkflowGraph }>('/copilot/optimize', {
      method: 'POST',
      body: JSON.stringify({ graph_json }),
    }),

  // A/B Arena Evaluator
  arenaCompare: (payload: {
    workflow_id: string
    inputs: Record<string, unknown>
    graph_override?: WorkflowGraph
    language: 'zh' | 'en'
    variant_a: { label: string; model: string; temperature: number; system_prompt_suffix: string }
    variant_b: { label: string; model: string; temperature: number; system_prompt_suffix: string }
  }) =>
    apiFetch<ArenaComparisonResult>('/arena/compare', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Eval Regression Suite
  listEvalCases: (workflowId?: string) =>
    apiFetch<EvalCaseItem[]>(workflowId ? `/evals?workflow_id=${encodeURIComponent(workflowId)}` : '/evals'),
  createEvalCase: (payload: {
    workflow_id: string
    name: string
    inputs_json: Record<string, string>
    assertions_json: EvalAssertionRule[]
  }) => apiFetch<EvalCaseItem>('/evals', { method: 'POST', body: JSON.stringify(payload) }),
  deleteEvalCase: (caseId: string) => apiFetch<void>(`/evals/${caseId}`, { method: 'DELETE' }),
  runEvalSuite: (payload: {
    workflow_id: string
    case_ids?: string[]
    graph_override?: WorkflowGraph
    language: 'zh' | 'en'
  }) => apiFetch<EvalRunReport>('/evals/run', { method: 'POST', body: JSON.stringify(payload) }),

  // Live HITL Approval Gate
  approveHitlGate: (
    runId: string,
    payload: { node_id: string; approved: boolean; edited_output?: string; comment?: string },
  ) =>
    apiFetch<{ ok: boolean }>(`/runs/${runId}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Cron Schedules & Webhook Simulator
  listSchedules: (workflowId?: string) =>
    apiFetch<ScheduleItem[]>(
      workflowId ? `/schedules?workflow_id=${encodeURIComponent(workflowId)}` : '/schedules',
    ),
  createSchedule: (payload: {
    workflow_id: string
    name: string
    cron_expression: string
    inputs_json: Record<string, unknown>
  }) => apiFetch<ScheduleItem>('/schedules', { method: 'POST', body: JSON.stringify(payload) }),
  deleteSchedule: (id: string) => apiFetch<void>(`/schedules/${id}`, { method: 'DELETE' }),
  triggerWebhook: (
    workflowId: string,
    payload: { inputs: Record<string, unknown>; language: 'zh' | 'en'; schedule_id?: string },
  ) =>
    apiFetch<{
      ok: boolean
      run_id: string
      status: string
      total_duration_ms: number
      total_tokens: number
      final_output: string
    }>(`/webhooks/${workflowId}/trigger`, { method: 'POST', body: JSON.stringify(payload) }),

  // Knowledge Docs & Live BM25 Search
  listKnowledge: () => apiFetch<KnowledgeDoc[]>('/knowledge'),
  createKnowledge: (payload: { title: string; content: string }) =>
    apiFetch<KnowledgeDoc>('/knowledge', { method: 'POST', body: JSON.stringify(payload) }),
  updateKnowledge: (id: string, payload: { title?: string; content?: string }) =>
    apiFetch<KnowledgeDoc>(`/knowledge/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteKnowledge: (id: string) => apiFetch<void>(`/knowledge/${id}`, { method: 'DELETE' }),
  searchKnowledge: (payload: { query: string; top_k?: number; doc_ids?: string[] }) =>
    apiFetch<KnowledgeSearchResponse>('/knowledge/search', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Runs & Analytics
  listRuns: (workflowId?: string) =>
    apiFetch<WorkflowRunSummary[]>(
      workflowId ? `/runs?workflow_id=${encodeURIComponent(workflowId)}` : '/runs',
    ),
  getRunDetail: (runId: string) => apiFetch<WorkflowRunDetail>(`/runs/${runId}`),
  deleteRun: (runId: string) => apiFetch<void>(`/runs/${runId}`, { method: 'DELETE' }),
  getAnalyticsSummary: () => apiFetch<AnalyticsSummary>('/analytics/summary'),

  // Provider settings
  getProviderConfig: () => apiFetch<ProviderConfig>('/settings/provider'),
  updateProviderConfig: (payload: {
    name: string
    provider_mode: 'DEMO' | 'OPENAI_COMPAT'
    base_url: string
    api_key?: string | null
    clear_api_key?: boolean
    default_model: string
  }) => apiFetch<ProviderConfig>('/settings/provider', { method: 'PUT', body: JSON.stringify(payload) }),
  testProvider: (payload: { base_url: string; api_key?: string | null; model: string }) =>
    apiFetch<ProviderTestResult>('/settings/provider/test', { method: 'POST', body: JSON.stringify(payload) }),
}

export interface SSEEventMessage {
  event: string
  data: Record<string, unknown>
}

export async function streamWorkflowRun(params: {
  workflowId: string
  inputs: Record<string, unknown>
  graphOverride: WorkflowGraph
  language: 'zh' | 'en'
  signal: AbortSignal
  onEvent: (evt: SSEEventMessage) => void
}): Promise<void> {
  const resp = await fetch(`${API_BASE}/workflows/${params.workflowId}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      inputs: params.inputs,
      graph_override: params.graphOverride,
      language: params.language,
    }),
    signal: params.signal,
  })

  if (!resp.ok) {
    let message = `HTTP ${resp.status}`
    try {
      const err = await resp.json()
      message = err?.detail?.message || err?.detail || message
    } catch {
      message = (await resp.text()) || message
    }
    throw new Error(message)
  }

  if (!resp.body) {
    throw new Error('Streaming response body is empty')
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  const processBlock = (block: string) => {
    const lines = block.split(/\r?\n/)
    let eventName = 'message'
    const dataLines: string[] = []
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim())
      }
    }
    if (dataLines.length === 0) return
    const raw = dataLines.join('\n')
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      params.onEvent({ event: eventName, data: parsed })
    } catch {
      params.onEvent({ event: eventName, data: { raw } })
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() || ''
    for (const blk of blocks) {
      if (blk.trim()) processBlock(blk)
    }
  }

  if (buffer.trim()) {
    processBlock(buffer)
  }
}
