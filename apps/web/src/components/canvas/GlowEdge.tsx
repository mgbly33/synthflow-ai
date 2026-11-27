import { useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { X } from 'lucide-react'
import { useStudioStore } from '../../store/useStudioStore'

export function GlowEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  selected,
  markerEnd,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)
  const activeEdgeIds = useStudioStore((s) => s.activeEdgeIds)
  const deleteEdge = useStudioStore((s) => s.deleteEdge)
  const targetStatus = useStudioStore((s) => s.nodeRuntime[target]?.status)
  const sourceStatus = useStudioStore((s) => s.nodeRuntime[source]?.status)

  const isActivated = activeEdgeIds.includes(id)
  const isFlowing = isActivated && (targetStatus === 'running' || targetStatus === 'completed')
  const isSkipped = targetStatus === 'skipped' || sourceStatus === 'skipped'

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const strokeColor = isFlowing
    ? '#8B5CF6'
    : selected || hovered
      ? '#6366F1'
      : isSkipped
        ? '#334155'
        : '#64748B'

  return (
    <g
      className="group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Wide invisible hit target for easy hover & click */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={18} className="cursor-pointer" />

      {isFlowing && (
        <path
          d={edgePath}
          fill="none"
          stroke="#8B5CF6"
          strokeWidth={7}
          strokeOpacity={0.22}
          className="pointer-events-none"
        />
      )}

      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth: isFlowing ? 2.5 : selected || hovered ? 2.4 : 1.85,
          opacity: isSkipped ? 0.3 : 0.92,
        }}
      />

      {isFlowing && (
        <>
          <path
            d={edgePath}
            fill="none"
            stroke="#DDD6FE"
            strokeWidth={2.5}
            className="edge-flow-active pointer-events-none"
          />
          <circle r="4" fill="#C4B5FD" className="pointer-events-none">
            <animateMotion dur="1.05s" repeatCount="indefinite" path={edgePath} />
          </circle>
        </>
      )}

      <EdgeLabelRenderer>
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="flex items-center gap-1"
        >
          {label && (
            <span
              className={[
                'rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold border shadow-sm backdrop-blur-md',
                String(label).toLowerCase() === 'true'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                  : String(label).toLowerCase() === 'false'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40'
                    : 'bg-pink-500/15 text-pink-600 dark:text-pink-300 border-pink-500/35',
              ].join(' ')}
            >
              {label}
            </span>
          )}
          {(selected || hovered) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                deleteEdge(id)
              }}
              title="Disconnect edge"
              className="flex h-5 w-5 items-center justify-center rounded-full border border-rose-500/50 bg-rose-600 text-white shadow-lg hover:scale-110 transition-transform"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </g>
  )
}
