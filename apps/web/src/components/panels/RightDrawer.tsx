import { PlayCircle, Sliders } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStudioStore } from '../../store/useStudioStore'
import { NodeInspector } from './NodeInspector'
import { RunPlayground } from './RunPlayground'

export function RightDrawer() {
  const { t } = useTranslation()
  const rightTab = useStudioStore((s) => s.rightTab)
  const setRightTab = useStudioStore((s) => s.setRightTab)
  const isRunning = useStudioStore((s) => s.isRunning)

  return (
    <aside
      data-tour="right-drawer"
      className="flex h-full w-[420px] shrink-0 flex-col border-l border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#0D121C]"
    >
      <div className="grid grid-cols-2 gap-1 border-b border-slate-200/90 dark:border-white/[0.08] p-2">
        <button
          onClick={() => setRightTab('playground')}
          className={[
            'flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-semibold transition-all',
            rightTab === 'playground'
              ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] border border-transparent',
          ].join(' ')}
        >
          <PlayCircle className="h-3.5 w-3.5" />
          <span>{t('playground')}</span>
          {isRunning && <span className="h-2 w-2 rounded-full bg-violet-500 animate-ping" />}
        </button>
        <button
          onClick={() => setRightTab('inspector')}
          className={[
            'flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-semibold transition-all',
            rightTab === 'inspector'
              ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300 border border-violet-500/30 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] border border-transparent',
          ].join(' ')}
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>{t('inspector')}</span>
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {rightTab === 'inspector' ? <NodeInspector /> : <RunPlayground />}
      </div>
    </aside>
  )
}
