import type { Edge, Node } from '@xyflow/react'

export type SynthNodeType =
  | 'input'
  | 'knowledge'
  | 'llm'
  | 'condition'
  | 'classifier'
  | 'http'
  | 'code'
  | 'aggregator'
  | 'loop'
  | 'approval'
  | 'note'
  | 'output'

export type WorkspaceView = 'studio' | 'arena' | 'evals' | 'analytics' | 'deploy'

export interface InputFieldSchema {
  name: string
  label: string
  labelEn?: string
  type: 'text' | 'textarea' | 'select'
  placeholder?: string
  options?: string[]
  required?: boolean
  defaultValue?: string
}

export interface ClassifierCategory {
  id: string
  label: string
  keywords?: string
  description?: string
}

export interface SynthNodeData extends Record<string, unknown> {
  label: string
  labelEn?: string
  // Input node
  fields?: InputFieldSchema[]
  sampleInputs?: Record<string, string>
  // Knowledge node
  queryTemplate?: string
  topK?: number
  docIds?: string[]
  // LLM node
  role?: string
  model?: string
  temperature?: number
  systemPrompt?: string
  userPrompt?: string
  // Condition node
  sourceTemplate?: string
  operator?:
    | 'contains'
    | 'not_contains'
    | 'contains_any'
    | 'length_gt'
    | 'length_lt'
    | 'equals'
    | 'regex'
    | 'json_field_equals'
  value?: string
  caseSensitive?: boolean
  trueLabel?: string
  falseLabel?: string
  // Classifier node
  categories?: ClassifierCategory[]
  // Code / Transform node
  transformMode?: 'markdown_summary' | 'json_extract' | 'regex_replace' | 'expression'
  expression?: string
  jsonPath?: string
  regexPattern?: string
  regexReplacement?: string
  // Aggregator node
  strategy?: 'markdown_merge' | 'first_non_empty' | 'json_bundle'
  separator?: string
  // Loop / Batch node
  delimiter?: string
  itemTemplate?: string
  // HITL Approval node
  instructions?: string
  // Sticky Note annotation node
  content?: string
  color?: 'violet' | 'amber' | 'cyan' | 'emerald'
  // HTTP Tool node
  method?: 'GET' | 'POST'
  url?: string
  headers?: Record<string, string>
  bodyTemplate?: string
  sandboxMode?: boolean
  // Output node
  title?: string
  template?: string
  format?: 'markdown' | 'json'
}

export type SynthNode = Node<SynthNodeData, SynthNodeType>
export type SynthEdge = Edge

export interface WorkflowGraph {
  nodes: SynthNode[]
  edges: SynthEdge[]
}

export interface WorkflowItem {
  id: string
  name: string
  name_en: string
  description: string
  description_en: string
  category: string
  is_template: boolean
  graph_json: WorkflowGraph
  created_at: string
  updated_at: string
}

export interface WorkflowVersionItem {
  id: string
  workflow_id: string
  version_number: number
  tag: string
  note: string
  graph_json: WorkflowGraph
  node_count: number
  edge_count: number
  created_at: string
}

export interface SingleNodeTestResult {
  node_id: string
  node_type: string
  status: string
  input_snapshot: string
  output_text: string
  duration_ms: number
  tokens_used: number
  error_message?: string | null
}

export interface KnowledgeDoc {
  id: string
  title: string
  content: string
  chunks_json: Array<{ index: number; text: string; char_count: number }>
  created_at: string
  updated_at: string
}

export interface KnowledgeSearchMatch {
  doc_id: string
  doc_title: string
  chunk_index: number
  score: number
  text: string
}

export interface KnowledgeSearchResponse {
  query: string
  total_matches: number
  matches: KnowledgeSearchMatch[]
}

export type NodeRuntimeStatus =
  | 'idle'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'skipped'
  | 'error'

export interface NodeRuntimeState {
  status: NodeRuntimeStatus
  output: string
  inputSnapshot?: string
  durationMs?: number
  offsetMs?: number
  tokensUsed?: number
  error?: string
  nodeLabel?: string
  nodeType?: string
}

export interface PendingApprovalGate {
  runId: string
  nodeId: string
  nodeLabel: string
  instructions: string
  pendingOutput: string
}

export interface NodeRunLog {
  id: string
  run_id: string
  node_id: string
  node_type: string
  node_label: string
  status: string
  input_snapshot: string
  output_text: string
  duration_ms: number
  offset_ms: number
  tokens_used: number
  error_message: string | null
  created_at: string
}

export interface WorkflowRunSummary {
  id: string
  workflow_id: string | null
  workflow_name: string
  status: string
  provider_mode: 'DEMO' | 'OPENAI_COMPAT' | string
  inputs_json: Record<string, unknown>
  final_output: string
  total_duration_ms: number
  total_tokens: number
  started_at: string
  finished_at: string | null
}

export interface WorkflowRunDetail extends WorkflowRunSummary {
  node_logs: NodeRunLog[]
}

export interface AnalyticsSummary {
  total_workflows: number
  total_templates: number
  total_knowledge_docs: number
  total_runs: number
  completed_runs: number
  failed_runs: number
  success_rate: number
  avg_duration_ms: number
  total_tokens: number
  estimated_saved_usd: number
  node_type_stats: Array<{
    node_type: string
    executions: number
    avg_duration_ms: number
    total_tokens: number
  }>
  recent_trend: Array<{
    run_id: string
    workflow_name: string
    duration_ms: number
    tokens: number
    status: string
    started_at: string
  }>
}

export interface CopilotBlueprint {
  name: string
  description: string
  category: string
  rationale: string
  graph_json: WorkflowGraph
  saved_workflow_id?: string | null
}

export interface ArenaScores {
  structure_score: number
  depth_score: number
  speed_score: number
  efficiency_score: number
  overall_score: number
}

export interface ArenaVariantOutput {
  label: string
  model: string
  temperature: number
  status: string
  duration_ms: number
  tokens: number
  output: string
  scores: ArenaScores
}

export interface ArenaComparisonResult {
  winner: 'A' | 'B' | 'TIE'
  variant_a: ArenaVariantOutput
  variant_b: ArenaVariantOutput
}

export interface EvalAssertionRule {
  type: 'contains' | 'not_contains' | 'min_length' | 'max_latency_ms' | 'branch_taken' | 'no_errors'
  value: string
}

export interface EvalCaseItem {
  id: string
  workflow_id: string
  name: string
  inputs_json: Record<string, string>
  assertions_json: EvalAssertionRule[]
  created_at: string
}

export interface EvalRunReport {
  workflow_id: string
  workflow_name: string
  total_cases: number
  passed_cases: number
  pass_rate: number
  results: Array<{
    case_id: string
    case_name: string
    passed: boolean
    status: string
    duration_ms: number
    tokens: number
    output_preview: string
    assertions: Array<{ type: string; value: string; passed: boolean; detail: string }>
  }>
}

export interface ScheduleItem {
  id: string
  workflow_id: string
  name: string
  cron_expression: string
  inputs_json: Record<string, unknown>
  webhook_token: string
  is_enabled: boolean
  last_triggered_at: string | null
  trigger_count: number
  created_at: string
}

export interface ProviderConfig {
  id: string
  name: string
  provider_mode: 'DEMO' | 'OPENAI_COMPAT'
  base_url: string
  masked_api_key: string
  has_api_key: boolean
  default_model: string
  is_active: boolean
  updated_at: string
}

export interface ProviderTestResult {
  ok: boolean
  latency_ms: number
  message: string
  model_reply?: string | null
}
