import React, { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  Copy,
  FileOutput,
  GitBranch,
  Globe,
  Loader2,
  Merge,
  PlaySquare,
  Repeat,
  ShieldAlert,
  ShieldCheck,
  SkipForward,
  Sparkles,
  StickyNote,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStudioStore } from '../../store/useStudioStore'
import type { ClassifierCategory, SynthNode, SynthNodeType } from '../../types/workflow'
import { NODE_ACCENT_META } from '../../utils/layout'
import { selectLineage } from '../../store/graphSelectors'

const NODE_ICONS: Record<SynthNodeType, React.FC<{ className?: string }>> = {
  input: PlaySquare,
  knowledge: BookOpen,
  llm: Bot,
  condition: GitBranch,
  classifier: Sparkles,
  http: Globe,
  code: Code2,
  aggregator: Merge,
  loop: Repeat,
  approval: ShieldAlert,
  note: StickyNote,
  output: FileOutput,
}

export const StudioNode = memo(({ id, data, type, selected }: NodeProps<SynthNode>) => {
  const { t } = useTranslation()
  const language = useStudioStore((s) => s.language)
  const runtime = useStudioStore((s) => s.nodeRuntime[id])
  const isDimmedByLineage = useStudioStore((s) => selectLineage(s)?.has(id) === false)
  const testingNodeId = useStudioStore((s) => s.testingNodeId)
  const testNodeIsolated = useStudioStore((s) => s.testNodeIsolated)
  const duplicateNode = useStudioStore((s) => s.duplicateNode)
  const deleteNode = useStudioStore((s) => s.deleteNode)

  const [peekOutput, setPeekOutput] = useState(false)

  const nodeType = (type || 'llm') as SynthNodeType

  // Sticky Note Architecture Callout Card (non-executable)
  if (nodeType === 'note') {
    const tone =
      data.color === 'violet'
        ? 'border-violet-500/35 bg-violet-500/10 text-violet-900 dark:text-violet-100'
        : data.color === 'cyan'
          ? 'border-cyan-500/35 bg-cyan-500/10 text-cyan-900 dark:text-cyan-100'
          : 'border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100'
    return (
      <div
        className={`group relative w-[260px] rounded-2xl border p-3.5 backdrop-blur-md shadow-lg transition-all ${tone} ${
          selected ? 'ring-2 ring-amber-400/70' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <StickyNote className="h-3.5 w-3.5 opacity-80" />
            <span className="truncate">{data.label || '架构批注'}</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              deleteNode(id)
            }}
            className="nodrag rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-black/10"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
        <p className="text-[11px] leading-relaxed opacity-85 whitespace-pre-wrap">
          {data.content || '点击右侧面板编辑批注内容...'}
        </p>
      </div>
    )
  }

  const accent = NODE_ACCENT_META[nodeType] || NODE_ACCENT_META.llm
  const Icon = NODE_ICONS[nodeType] || Bot

  const status = runtime?.status || 'idle'
  const isTesting = testingNodeId === id
  const isWaitingApproval = status === 'waiting_approval'
  const isRunning = status === 'running' || isTesting || isWaitingApproval
  const isCompleted = status === 'completed'
  const isSkipped = status === 'skipped'
  const isError = status === 'error'

  const displayLabel =
    (language === 'en' && data.labelEn ? data.labelEn : data.label) || t(`nodeTypes.${nodeType}`)

  const categories: ClassifierCategory[] =
    nodeType === 'classifier'
      ? data.categories && data.categories.length > 0
        ? data.categories
        : [
            { id: 'tech', label: '技术支持' },
            { id: 'sales', label: '商务报价' },
            { id: 'refund', label: '退款关怀' },
          ]
      : []

  // Build crisp structured tags per node type
  const chips: Array<{ text: string; tone?: string }> = []
  if (nodeType === 'input') {
    const flds = data.fields || []
    chips.push({ text: `${flds.length} ${language === 'en' ? 'Fields' : '字段'}` })
    if (flds[0]?.name) chips.push({ text: `{{input.${flds[0].name}}}` })
  } else if (nodeType === 'knowledge') {
    chips.push({ text: `BM25 Top-${data.topK || 3}` })
    chips.push({ text: (data.docIds?.length || 0) > 0 ? `${data.docIds!.length} Docs` : 'All KB' })
  } else if (nodeType === 'llm') {
    chips.push({ text: data.model || 'default' })
    chips.push({ text: `T=${data.temperature ?? 0.7}` })
  } else if (nodeType === 'condition') {
    chips.push({ text: data.operator || 'contains' })
    chips.push({ text: `"${(data.value || '').slice(0, 18)}"` })
  } else if (nodeType === 'classifier') {
    chips.push({ text: `${categories.length} ${language === 'en' ? 'Routes' : '路意图'}` })
    chips.push({ text: categories.map((c) => c.label).slice(0, 2).join(' / ') })
  } else if (nodeType === 'http') {
    chips.push({ text: data.method || 'GET' })
    chips.push({ text: data.sandboxMode !== false ? 'Sandbox' : 'Live HTTPS' })
  } else if (nodeType === 'code') {
    chips.push({ text: data.transformMode || 'markdown_summary' })
    chips.push({ text: 'AST Sandbox' })
  } else if (nodeType === 'aggregator') {
    chips.push({ text: data.strategy || 'markdown_merge' })
  } else if (nodeType === 'loop') {
    chips.push({ text: `Split "${data.delimiter || ','}"` })
    chips.push({ text: 'Batch Map' })
  } else if (nodeType === 'approval') {
    chips.push({ text: 'HITL Pause Gate' })
    chips.push({ text: isWaitingApproval ? '⏳ 等待人工审签' : 'Approve / Edit' })
  } else if (nodeType === 'output') {
    chips.push({ text: (data.format || 'markdown').toUpperCase() })
    chips.push({ text: (data.title || 'Report').slice(0, 16) })
  }

  // Dynamic height cushion when classifier has 3+ categories
  const minCardHeight = nodeType === 'classifier' ? Math.max(138, 56 + categories.length * 32) : undefined

  return (
    <div
      style={
        {
          '--aura-color': accent.color,
          '--aura-glow': accent.bgGlow,
          '--aura-ring': accent.ring,
          minHeight: minCardHeight,
        } as React.CSSProperties
      }
      className={[
        'group relative w-[280px] rounded-2xl transition-all duration-200 select-none',
        'bg-white/95 dark:bg-[#121824]/95 backdrop-blur-xl',
        'border',
        isRunning
          ? 'node-running-aura border-transparent'
          : isError
            ? 'border-rose-500/80 shadow-[0_8px_28px_rgba(244,63,94,0.28)]'
            : selected
              ? 'border-violet-500/90 dark:border-violet-400 shadow-[0_0_0_2px_rgba(139,92,246,0.28),0_16px_36px_-8px_rgba(0,0,0,0.45)]'
              : isCompleted
                ? 'border-emerald-500/50 dark:border-emerald-400/40 shadow-[0_10px_28px_-10px_rgba(16,185,129,0.25)]'
                : 'border-slate-200/90 dark:border-white/[0.09] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)] dark:shadow-[0_14px_34px_-12px_rgba(0,0,0,0.7)] hover:border-slate-300 dark:hover:border-white/20',
        isSkipped ? 'opacity-45 grayscale-[45%]' : isDimmedByLineage ? 'opacity-35 saturate-50' : '',
      ].join(' ')}
    >
      {/* Floating Hover Quick Action Pill */}
      <div className="nodrag nopan absolute -top-9 right-2 z-20 flex items-center gap-0.5 rounded-xl border border-slate-200 dark:border-white/15 bg-white/95 dark:bg-[#172030]/95 p-1 shadow-xl backdrop-blur opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            testNodeIsolated(id)
          }}
          title={t('testSingleNode')}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-amber-600 dark:text-amber-300 hover:bg-amber-500/15 transition-colors"
        >
          <Zap className="h-3 w-3" />
          <span>{t('testSingleNode')}</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            duplicateNode(id)
          }}
          title={t('duplicate')}
          className="rounded-lg p-1 text-slate-500 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/10"
        >
          <Copy className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            deleteNode(id)
          }}
          title={t('delete')}
          className="rounded-lg p-1 text-slate-500 hover:bg-rose-500/15 hover:text-rose-500"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Top Semantic Accent Gradient Strip + Ambient Inner Glow */}
      <div className="relative h-1.5 w-full overflow-hidden rounded-t-[15px]">
        <div
          className={`h-full w-full bg-gradient-to-r ${accent.gradient}`}
        />
        {isRunning && (
          <div className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/80 to-transparent animate-shimmer" />
        )}
      </div>

      {/* Left Target Handle */}
      {nodeType !== 'input' && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ backgroundColor: accent.color }}
          className="!-left-[6px]"
        />
      )}

      <div className="px-3.5 py-3">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-inner"
              style={{
                background: `linear-gradient(135deg, ${accent.color}28, ${accent.color}0D)`,
                borderColor: `${accent.color}48`,
                color: accent.color,
              }}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                {displayLabel}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className="rounded px-1.5 py-[1px] text-[9px] font-mono font-bold tracking-wider"
                  style={{
                    backgroundColor: `${accent.color}1F`,
                    color: accent.color,
                  }}
                >
                  {accent.label}
                </span>
                <span className="truncate text-[10px] font-mono text-slate-400 dark:text-slate-500">
                  {id}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Structured Parameter Chips */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {chips.map((c, idx) => (
            <span
              key={idx}
              className="max-w-[230px] truncate rounded-lg border border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0A0E16] px-2 py-0.5 font-mono text-[10.5px] text-slate-600 dark:text-slate-300"
            >
              {c.text}
            </span>
          ))}
        </div>

        {/* Live Token Stream Peek (while running) */}
        {isRunning && runtime?.output && (
          <div className="mt-2.5 max-h-14 overflow-hidden rounded-xl bg-violet-500/10 border border-violet-500/25 px-2.5 py-1.5 text-[10.5px] font-mono text-violet-700 dark:text-violet-200 leading-snug">
            {runtime.output.slice(-100)}
            <span className="inline-block w-1.5 h-3 ml-0.5 bg-violet-400 animate-pulse align-middle" />
          </div>
        )}

        {/* Expandable Inline Output Peek (after completion) */}
        {isCompleted && runtime?.output && peekOutput && (
          <div className="nodrag nowheel mt-2.5 max-h-28 overflow-y-auto rounded-xl border border-emerald-500/25 bg-slate-50 dark:bg-[#0A0E16] p-2 font-mono text-[10.5px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
            {runtime.output.slice(0, 420)}
            {runtime.output.length > 420 ? '…' : ''}
          </div>
        )}

        {/* Footer Telemetry & Status Row */}
        <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-2 min-w-0">
            {nodeType === 'http' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3" />
                {t('ssrfBadge')}
              </span>
            ) : runtime?.tokensUsed ? (
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-400">
                {runtime.tokensUsed} tok
              </span>
            ) : (
              <span className="text-[10px] font-mono text-slate-400/70 dark:text-slate-600">
                ready
              </span>
            )}

            {isCompleted && runtime?.output && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setPeekOutput((v) => !v)
                }}
                className="nodrag inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
              >
                {peekOutput ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                <span>{peekOutput ? (language === 'en' ? 'Hide' : '收起') : language === 'en' ? 'Peek' : '预览'}</span>
              </button>
            )}
          </div>

          {/* Status Pill */}
          <div
            className={[
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-medium border',
              isRunning
                ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/40'
                : isCompleted
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/40'
                  : isSkipped
                    ? 'bg-slate-500/15 text-slate-500 dark:text-slate-400 border-slate-500/30'
                    : isError
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/40'
                      : 'bg-slate-100/90 dark:bg-white/[0.04] text-slate-500 dark:text-slate-400 border-slate-200/80 dark:border-white/[0.08]',
            ].join(' ')}
          >
            {isRunning && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
            {isCompleted && <CheckCircle2 className="h-2.5 w-2.5" />}
            {isSkipped && <SkipForward className="h-2.5 w-2.5" />}
            {isError && <XCircle className="h-2.5 w-2.5" />}
            {status === 'idle' && !isTesting && <Clock className="h-2.5 w-2.5 opacity-60" />}
            <span>
              {isCompleted && runtime?.durationMs !== undefined
                ? `${runtime.durationMs}ms`
                : isTesting
                  ? t('testingNode')
                  : t(`status.${status}`)}
            </span>
          </div>
        </div>
      </div>

      {/* Right Source Handles */}
      {nodeType === 'condition' ? (
        <>
          <div className="pointer-events-none absolute right-2 top-[35%] -translate-y-1/2">
            <span className="rounded bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-mono font-bold text-emerald-500">
              TRUE
            </span>
          </div>
          <Handle
            type="source"
            id="true"
            position={Position.Right}
            style={{ top: '35%', backgroundColor: '#10B981' }}
            className="!-right-[6px]"
          />
          <div className="pointer-events-none absolute right-2 top-[70%] -translate-y-1/2">
            <span className="rounded bg-amber-500/15 border border-amber-500/40 px-1.5 py-0.5 text-[9px] font-mono font-bold text-amber-500">
              FALSE
            </span>
          </div>
          <Handle
            type="source"
            id="false"
            position={Position.Right}
            style={{ top: '70%', backgroundColor: '#F59E0B' }}
            className="!-right-[6px]"
          />
        </>
      ) : nodeType === 'classifier' ? (
        <>
          {categories.map((cat, idx) => {
            const topPct = Math.round(((idx + 1) / (categories.length + 1)) * 100)
            return (
              <React.Fragment key={cat.id}>
                <div
                  style={{ top: `${topPct}%` }}
                  className="pointer-events-none absolute right-2.5 -translate-y-1/2"
                >
                  <span className="rounded bg-pink-500/15 border border-pink-500/35 px-1.5 py-0.5 text-[9px] font-medium text-pink-500 dark:text-pink-300">
                    {cat.label}
                  </span>
                </div>
                <Handle
                  type="source"
                  id={cat.id}
                  position={Position.Right}
                  style={{ top: `${topPct}%`, backgroundColor: '#EC4899' }}
                  className="!-right-[6px]"
                />
              </React.Fragment>
            )
          })}
        </>
      ) : nodeType !== 'output' ? (
        <Handle
          type="source"
          position={Position.Right}
          style={{ backgroundColor: accent.color }}
          className="!-right-[6px]"
        />
      ) : null}
    </div>
  )
})

StudioNode.displayName = 'StudioNode'
