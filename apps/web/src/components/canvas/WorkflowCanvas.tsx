import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  AlertTriangle,
  CheckCircle2,
  Command,
  Copy,
  FileCode2,
  Film,
  Grid,
  LayoutGrid,
  Map as MapIcon,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Sparkles,
  Trash2,
  Wand2,
  X,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStudioStore } from '../../store/useStudioStore'
import type { SynthNodeType } from '../../types/workflow'
import { exportGraphToMermaid, NODE_ACCENT_META, validateGraphClient } from '../../utils/layout'
import { GlowEdge } from './GlowEdge'
import { StudioNode } from './StudioNode'

const nodeTypes: NodeTypes = {
  input: StudioNode,
  knowledge: StudioNode,
  llm: StudioNode,
  condition: StudioNode,
  classifier: StudioNode,
  http: StudioNode,
  code: StudioNode,
  aggregator: StudioNode,
  loop: StudioNode,
  approval: StudioNode,
  note: StudioNode,
  output: StudioNode,
}

const edgeTypes: EdgeTypes = {
  glow: GlowEdge,
}

const QUICK_ADD_NODES: SynthNodeType[] = [
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

export function WorkflowCanvas() {
  const { t } = useTranslation()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()

  const nodes = useStudioStore((s) => s.nodes)
  const edges = useStudioStore((s) => s.edges)
  const activeWorkflowId = useStudioStore((s) => s.activeWorkflowId)
  const theme = useStudioStore((s) => s.theme)
  const language = useStudioStore((s) => s.language)
  const leftCollapsed = useStudioStore((s) => s.leftCollapsed)
  const rightCollapsed = useStudioStore((s) => s.rightCollapsed)
  const toggleLeftCollapsed = useStudioStore((s) => s.toggleLeftCollapsed)
  const toggleRightCollapsed = useStudioStore((s) => s.toggleRightCollapsed)
  const pushHistory = useStudioStore((s) => s.pushHistory)
  const snapToGrid = useStudioStore((s) => s.snapToGrid)
  const showMiniMap = useStudioStore((s) => s.showMiniMap)
  const toggleSnapToGrid = useStudioStore((s) => s.toggleSnapToGrid)
  const toggleMiniMap = useStudioStore((s) => s.toggleMiniMap)
  const onNodesChange = useStudioStore((s) => s.onNodesChange)
  const onEdgesChange = useStudioStore((s) => s.onEdgesChange)
  const onConnect = useStudioStore((s) => s.onConnect)
  const selectNode = useStudioStore((s) => s.selectNode)
  const addNode = useStudioStore((s) => s.addNode)
  const duplicateNode = useStudioStore((s) => s.duplicateNode)
  const deleteNode = useStudioStore((s) => s.deleteNode)
  const testNodeIsolated = useStudioStore((s) => s.testNodeIsolated)
  const autoLayout = useStudioStore((s) => s.autoLayout)
  const resetRuntime = useStudioStore((s) => s.resetRuntime)
  const setCommandOpen = useStudioStore((s) => s.setCommandOpen)
  const setCopilotOpen = useStudioStore((s) => s.setCopilotOpen)
  const optimizeCurrentGraph = useStudioStore((s) => s.optimizeCurrentGraph)
  const showToast = useStudioStore((s) => s.showToast)
  const replayRun = useStudioStore((s) => s.replayRun)
  const replayStep = useStudioStore((s) => s.replayStep)
  const replayPlaying = useStudioStore((s) => s.replayPlaying)
  const setReplayStep = useStudioStore((s) => s.setReplayStep)
  const setReplayPlaying = useStudioStore((s) => s.setReplayPlaying)
  const stopCanvasReplay = useStudioStore((s) => s.stopCanvasReplay)
  const undo = useStudioStore((s) => s.undo)
  const redo = useStudioStore((s) => s.redo)
  const saveWorkflow = useStudioStore((s) => s.saveWorkflow)

  // Auto-advance Canvas Frame-by-Frame Replay timer
  useEffect(() => {
    if (!replayRun || !replayPlaying) return
    const timer = setInterval(() => {
      const cur = useStudioStore.getState().replayStep
      if (cur >= replayRun.node_logs.length) {
        setReplayPlaying(false)
      } else {
        setReplayStep(cur + 1)
      }
    }, 950)
    return () => clearInterval(timer)
  }, [replayRun, replayPlaying, setReplayStep, setReplayPlaying])

  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    flowPos: { x: number; y: number }
    nodeId?: string
  } | null>(null)

  const health = useMemo(() => validateGraphClient(nodes, edges), [nodes, edges])

  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.28, duration: 300 })
    }, 100)
    return () => clearTimeout(timer)
  }, [activeWorkflowId, leftCollapsed, rightCollapsed, fitView])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen(true)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveWorkflow()
        return
      }
      const target = e.target as HTMLElement | null
      const inEditable =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (inEditable) return

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, saveWorkflow, setCommandOpen])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/synthflow-node') as SynthNodeType
      if (!type) return
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      addNode(type, position)
    },
    [screenToFlowPosition, addNode],
  )

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault()
      const bounds = wrapperRef.current?.getBoundingClientRect()
      const clientX = event.clientX
      const clientY = event.clientY
      setContextMenu({
        x: clientX - (bounds?.left || 0),
        y: clientY - (bounds?.top || 0),
        flowPos: screenToFlowPosition({ x: clientX, y: clientY }),
      })
    },
    [screenToFlowPosition],
  )

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: { id: string }) => {
      event.preventDefault()
      const bounds = wrapperRef.current?.getBoundingClientRect()
      setContextMenu({
        x: event.clientX - (bounds?.left || 0),
        y: event.clientY - (bounds?.top || 0),
        flowPos: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        nodeId: node.id,
      })
    },
    [screenToFlowPosition],
  )

  return (
    <div
      ref={wrapperRef}
      data-tour="canvas-area"
      onClick={() => {
        if (contextMenu) setContextMenu(null)
        if (quickAddOpen) setQuickAddOpen(false)
      }}
      className="studio-canvas-bg relative h-full w-full overflow-hidden"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={() => pushHistory()}
        onConnect={onConnect}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        onDragOver={onDragOver}
        onDrop={onDrop}
        snapToGrid={snapToGrid}
        snapGrid={[16, 16]}
        defaultEdgeOptions={{
          type: 'glow',
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#64748B' },
        }}
        fitView
        fitViewOptions={{ padding: 0.24 }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.35}
          color={theme === 'dark' ? 'rgba(148, 163, 184, 0.16)' : 'rgba(100, 116, 139, 0.22)'}
        />
        <Controls position="bottom-left" showInteractive={false} />
        {showMiniMap && (
          <MiniMap
            position="bottom-right"
            style={{ marginBottom: 52 }}
            pannable
            zoomable
            nodeColor={(n) => {
              const nt = (n.type || 'llm') as SynthNodeType
              return NODE_ACCENT_META[nt]?.color || '#8B5CF6'
            }}
            maskColor={theme === 'dark' ? 'rgba(9, 12, 18, 0.72)' : 'rgba(241, 245, 249, 0.72)'}
          />
        )}
      </ReactFlow>

      {/* Top Canvas Toolbar Strip — unified flex row guarantees zero overlap at any width */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <div
            className={[
              'pointer-events-auto inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap backdrop-blur-xl shadow-lg',
              health.valid
                ? 'border-emerald-500/30 bg-white/90 dark:bg-[#111724]/85 text-emerald-600 dark:text-emerald-300'
                : 'border-rose-500/40 bg-rose-950/90 text-rose-200',
            ].join(' ')}
          >
            {health.valid ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{health.valid ? t('dagHealthy') : health.errors[0]}</span>
            <span className="h-3 w-px bg-current opacity-20" />
            <span className="font-mono text-[10px] opacity-80">
              {nodes.length}N · {edges.length}E
            </span>
          </div>

          <button
            data-tour="copilot-btn"
            onClick={() => setCopilotOpen(true)}
            className="pointer-events-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-violet-500/40 bg-gradient-to-r from-violet-600/90 to-cyan-600/90 hover:brightness-110 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-lg shadow-violet-600/25 backdrop-blur-xl transition-all"
          >
            <Wand2 className="h-3.5 w-3.5 shrink-0" />
            <span>{t('copilotBtn')}</span>
          </button>

          <button
            onClick={optimizeCurrentGraph}
            className="pointer-events-auto inline-flex items-center gap-1 whitespace-nowrap rounded-xl border border-slate-200 dark:border-white/12 bg-white/90 dark:bg-[#111724]/85 hover:border-violet-500/50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 shadow-lg backdrop-blur-xl transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>{t('optimizeGraph')}</span>
          </button>

          <button
            onClick={() => {
              const md = exportGraphToMermaid(nodes, edges)
              navigator.clipboard.writeText(`\`\`\`mermaid\n${md}\n\`\`\``)
              showToast('已复制 Mermaid 架构图代码到剪贴板', 'success')
            }}
            title="Export DAG as Mermaid Diagram"
            className="pointer-events-auto inline-flex items-center gap-1 whitespace-nowrap rounded-xl border border-slate-200 dark:border-white/12 bg-white/90 dark:bg-[#111724]/85 hover:border-cyan-500/50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 shadow-lg backdrop-blur-xl transition-colors"
          >
            <FileCode2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span>Mermaid</span>
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-1 shrink-0">
          <button
            onClick={toggleLeftCollapsed}
            title={leftCollapsed ? 'Expand Left Panel' : 'Collapse Left Panel'}
            className="rounded-xl border border-slate-200 dark:border-white/12 bg-white/90 dark:bg-[#121825]/90 p-1.5 text-slate-500 hover:text-violet-500 shadow-lg backdrop-blur-xl transition-colors"
          >
            {leftCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <button
            onClick={toggleRightCollapsed}
            title={rightCollapsed ? 'Expand Right Panel' : 'Collapse Right Panel'}
            className="rounded-xl border border-slate-200 dark:border-white/12 bg-white/90 dark:bg-[#121825]/90 p-1.5 text-slate-500 hover:text-violet-500 shadow-lg backdrop-blur-xl transition-colors"
          >
            {rightCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Live Frame-by-Frame Canvas Replay Scrubber Bar */}
      {replayRun && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-16 left-1/2 z-30 -translate-x-1/2 flex items-center gap-3 rounded-2xl border border-cyan-500/45 bg-[#0D1524]/95 px-4 py-2.5 text-xs text-white shadow-2xl backdrop-blur-xl"
        >
          <Film className="h-4 w-4 text-cyan-400 shrink-0" />
          <span className="font-semibold max-w-[160px] truncate">{replayRun.workflow_name}</span>
          <button
            onClick={() => setReplayPlaying(!replayPlaying)}
            className="rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 p-1.5 text-cyan-300"
          >
            {replayPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
          </button>
          <button
            onClick={() => setReplayStep(replayStep + 1)}
            className="rounded-lg bg-white/10 hover:bg-white/20 p-1.5 text-slate-200"
            title="Next Step"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>
          <input
            type="range"
            min={0}
            max={replayRun.node_logs.length}
            value={replayStep}
            onChange={(e) => setReplayStep(Number(e.target.value))}
            className="w-36 accent-cyan-400"
          />
          <span className="font-mono text-[11px] text-cyan-300">
            {replayStep}/{replayRun.node_logs.length}
          </span>
          <button
            onClick={stopCanvasReplay}
            className="rounded-lg p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Bottom-Center Floating Glass Canvas Dock (HUD) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 flex items-center gap-1 whitespace-nowrap rounded-2xl border border-slate-200/90 dark:border-white/12 bg-white/95 dark:bg-[#121825]/90 p-1.5 shadow-2xl backdrop-blur-xl"
      >
        <div className="relative shrink-0">
          <button
            onClick={() => setQuickAddOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-violet-600/25 transition-all"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>{language === 'en' ? 'Add Node' : '添加节点'}</span>
          </button>

          {quickAddOpen && (
            <div className="absolute bottom-12 left-0 w-64 rounded-2xl border border-slate-200 dark:border-white/12 bg-white/95 dark:bg-[#121825]/95 p-2 shadow-2xl backdrop-blur-xl grid grid-cols-2 gap-1.5">
              {QUICK_ADD_NODES.map((nt) => (
                <button
                  key={nt}
                  onClick={() => {
                    addNode(nt)
                    setQuickAddOpen(false)
                  }}
                  className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: NODE_ACCENT_META[nt].color }}
                  />
                  <span className="truncate">{t(`nodeTypes.${nt}`)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-white/10" />

        <button
          onClick={() => {
            autoLayout()
            setTimeout(() => fitView({ padding: 0.24, duration: 300 }), 40)
          }}
          title={t('autoLayout')}
          className="rounded-xl p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>

        <button
          onClick={() => fitView({ padding: 0.24, duration: 300 })}
          title="Fit View"
          className="rounded-xl p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        >
          <Maximize2 className="h-4 w-4" />
        </button>

        <button
          onClick={toggleSnapToGrid}
          title="Snap to Grid"
          className={[
            'rounded-xl p-2 transition-colors',
            snapToGrid
              ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10',
          ].join(' ')}
        >
          <Grid className="h-4 w-4" />
        </button>

        <button
          onClick={toggleMiniMap}
          title="Toggle MiniMap"
          className={[
            'rounded-xl p-2 transition-colors',
            showMiniMap
              ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10',
          ].join(' ')}
        >
          <MapIcon className="h-4 w-4" />
        </button>

        <button
          onClick={resetRuntime}
          title="Reset Runtime Highlights"
          className="rounded-xl p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-white/10" />

        <button
          onClick={() => setCommandOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-300 hover:border-violet-500/50 transition-colors"
        >
          <Command className="h-3 w-3" />
          <span>K</span>
        </button>
      </div>

      {/* Right-Click Context Menu */}
      {contextMenu && (
        <div
          style={{ left: Math.min(contextMenu.x, (wrapperRef.current?.clientWidth || 600) - 210), top: Math.min(contextMenu.y, (wrapperRef.current?.clientHeight || 500) - 260) }}
          onClick={(e) => e.stopPropagation()}
          className="absolute z-40 w-52 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/15 bg-white/95 dark:bg-[#131A28]/95 p-1.5 shadow-2xl backdrop-blur-xl text-xs"
        >
          {contextMenu.nodeId ? (
            <>
              <button
                onClick={() => {
                  testNodeIsolated(contextMenu.nodeId!)
                  setContextMenu(null)
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-amber-600 dark:text-amber-300 hover:bg-amber-500/15"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>{t('testSingleNode')}</span>
              </button>
              <button
                onClick={() => {
                  duplicateNode(contextMenu.nodeId!)
                  setContextMenu(null)
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{t('duplicate')}</span>
              </button>
              <div className="my-1 h-px bg-slate-200 dark:bg-white/10" />
              <button
                onClick={() => {
                  deleteNode(contextMenu.nodeId!)
                  setContextMenu(null)
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-rose-500 hover:bg-rose-500/15"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t('delete')}</span>
              </button>
            </>
          ) : (
            <>
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {language === 'en' ? 'Insert Node Here' : '在此处插入节点'}
              </div>
              {QUICK_ADD_NODES.slice(0, 6).map((nt) => (
                <button
                  key={nt}
                  onClick={() => {
                    addNode(nt, contextMenu.flowPos)
                    setContextMenu(null)
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: NODE_ACCENT_META[nt].color }}
                  />
                  <span>{t(`nodeTypes.${nt}`)}</span>
                </button>
              ))}
              <div className="my-1 h-px bg-slate-200 dark:bg-white/10" />
              <button
                onClick={() => {
                  autoLayout()
                  setContextMenu(null)
                }}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>{t('autoLayout')}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
