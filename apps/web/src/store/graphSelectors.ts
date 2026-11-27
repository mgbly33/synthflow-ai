import type { SynthEdge, SynthNode } from '../types/workflow'
import { computeDataLineage, validateGraphClient } from '../utils/layout'

type GraphState = { nodes: SynthNode[]; edges: SynthEdge[]; selectedNodeId: string | null }

// Inspector fields depend on node definitions, not canvas coordinates or selection styles.
let lastNodes: SynthNode[] | undefined
let definitions: SynthNode[] = []
export function selectInspectorNodes({ nodes }: GraphState) {
  if (nodes !== lastNodes) {
    if (nodes.length !== definitions.length || nodes.some((n, i) =>
      n.id !== definitions[i].id || n.type !== definitions[i].type || n.data !== definitions[i].data,
    )) definitions = nodes
    lastNodes = nodes
  }
  return definitions
}

let healthNodes: SynthNode[] = []
let healthEdges: SynthEdge[] = []
let health = validateGraphClient(healthNodes, healthEdges)
export function selectGraphHealth(state: GraphState) {
  const nodes = selectInspectorNodes(state)
  if (nodes === healthNodes && state.edges === healthEdges) return health
  const topologyChanged = nodes.length !== healthNodes.length || state.edges.length !== healthEdges.length ||
    (nodes !== healthNodes && nodes.some((n, i) => n.id !== healthNodes[i].id || n.type !== healthNodes[i].type)) ||
    (state.edges !== healthEdges && state.edges.some((e, i) =>
      e.source !== healthEdges[i].source || e.target !== healthEdges[i].target,
    ))
  if (topologyChanged) health = validateGraphClient(nodes, state.edges)
  healthNodes = nodes
  healthEdges = state.edges
  return health
}

let lineageEdges: SynthEdge[] | undefined
let lineageNodeId: string | null = null
let lineage: Set<string> | null = null
export function selectLineage({ edges, selectedNodeId }: GraphState) {
  if (selectedNodeId !== lineageNodeId || edges !== lineageEdges) {
    lineage = selectedNodeId ? computeDataLineage(selectedNodeId, edges) : null
    lineageNodeId = selectedNodeId
    lineageEdges = edges
  }
  return lineage
}
