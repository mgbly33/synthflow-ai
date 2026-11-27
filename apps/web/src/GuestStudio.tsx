import { useEffect, useMemo, useState } from 'react'
import { Background, Controls, Position, ReactFlow, useNodesState, type Edge, type Node } from '@xyflow/react'
import { Languages, Moon, Play, Sun, Workflow } from 'lucide-react'
import '@xyflow/react/dist/style.css'

const steps = [
  { id: 'input', zh: '接收工单', en: 'Receive ticket', x: 0, y: 90 },
  { id: 'classify', zh: '意图分类', en: 'Classify intent', x: 200, y: 90 },
  { id: 'billing', zh: '账单与退款', en: 'Billing & refunds', x: 400, y: 0 },
  { id: 'support', zh: '技术支持', en: 'Technical support', x: 400, y: 90 },
  { id: 'general', zh: '常规咨询', en: 'General inquiry', x: 400, y: 180 },
  { id: 'output', zh: '生成处理建议', en: 'Resolution note', x: 600, y: 90 },
]
const links = [
  ['input', 'classify'], ['classify', 'billing'], ['classify', 'support'], ['classify', 'general'],
  ['billing', 'output'], ['support', 'output'], ['general', 'output'],
]
const branches = {
  billing: { zh: '转交账单团队，核对订单号、扣款记录与退款状态。', en: 'Send to billing to verify the order, charges and refund status.' },
  support: { zh: '转交技术支持，收集错误信息、发生时间与复现步骤。', en: 'Send to technical support to collect the error, timestamp and steps to reproduce.' },
  general: { zh: '转交咨询团队，确认使用场景并提供入门指引。', en: 'Send to the service desk for guidance on the customer’s use case.' },
}
type Branch = keyof typeof branches
function classify(text: string): Branch {
  if (/退款|付款|扣款|发票|账单|refund|bill|charg|invoice|payment/i.test(text)) return 'billing'
  if (/报错|登录|故障|打不开|错误|超时|error|login|log in|crash|timeout/i.test(text)) return 'support'
  return 'general'
}

export default function GuestStudio() {
  const [lang, setLang] = useState<'zh' | 'en'>('zh')
  const [dark, setDark] = useState(true)
  const zh = lang === 'zh'
  const [input, setInput] = useState('')
  const [run, setRun] = useState<{ text: string; branch: Branch; index: number } | null>(null)
  const running = run !== null && run.index < 3
  const [nodes, , onNodesChange] = useNodesState<Node>(steps.map(s => ({
    id: s.id, position: { x: s.x, y: s.y }, data: { label: s.zh },
    targetPosition: Position.Left, sourcePosition: Position.Right,
    type: s.id === 'input' ? 'input' : s.id === 'output' ? 'output' : 'default',
  })))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.lang = zh ? 'zh-CN' : 'en'
  }, [dark, zh])
  useEffect(() => {
    if (!running) return
    const id = window.setTimeout(() => setRun(r => r && { ...r, index: r.index + 1 }), 380)
    return () => window.clearTimeout(id)
  }, [running, run?.index])
  const route = useMemo(() => run ? ['input', 'classify', run.branch, 'output'].slice(0, run.index + 1) : [], [run])
  const drawn = nodes.map((node) => ({
    ...node,
    data: { label: <span className={`block w-40 rounded-md border p-3 text-center text-sm font-medium ${
      route.includes(node.id)
        ? 'border-violet-500 bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-100'
        : 'border-zinc-400 bg-white text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100'
    }`}>{steps.find(step => step.id === node.id)?.[lang]}</span> },
  }))
  const edges: Edge[] = links.map(([source, target]) => {
    const active = route.includes(source) && route.includes(target)
    return { id: `${source}-${target}`, source, target, animated: active && running, style: active ? { stroke: '#8b78ef', strokeWidth: 3 } : {} }
  })
  return <main className="h-full overflow-y-auto bg-zinc-50 text-zinc-900 dark:bg-[#0d1015] dark:text-zinc-100">
    <header className="flex items-center gap-3 border-b border-zinc-500/30 px-5 py-4">
      <Workflow className="text-violet-500" /><h1 className="mr-auto font-semibold">SynthFlow</h1>
      <button aria-label={zh ? '切换主题' : 'Change theme'} onClick={() => setDark(!dark)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
      <button className="flex items-center gap-1" aria-label={zh ? '切换语言' : 'Change language'} onClick={() => setLang(zh ? 'en' : 'zh')}><Languages size={16}/>{zh ? 'EN' : '中文'}</button>
    </header>
    <div className="mx-auto max-w-[1500px] p-5 md:p-8">
      <h2 className="text-2xl font-semibold">{zh ? '客户工单分流' : 'Support ticket routing'}</h2>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{zh ? '访客演示 · 使用浏览器本地规则运行。输入仅在本页处理，不会调用大模型或保存工单。' : 'Guest demo · Local rules process your input in this tab. Tickets are not saved or sent to a model.'}</p>
      <div className="mt-5 grid overflow-hidden rounded-lg border border-zinc-500/30 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-[36vh] min-h-[250px] lg:h-[64vh]"><ReactFlow nodes={drawn} edges={edges} onNodesChange={onNodesChange} nodesConnectable={false} deleteKeyCode={null} colorMode={dark ? 'dark' : 'light'} fitView minZoom={0.15} fitViewOptions={{ padding: 0.12 }}><Background/><Controls showInteractive={false}/></ReactFlow></div>
        <section className="flex min-w-0 flex-col gap-3 border-t border-zinc-500/30 p-5 lg:border-l lg:border-t-0">
          <label htmlFor="ticket" className="font-medium">{zh ? '工单内容' : 'Ticket text'}</label>
          <textarea id="ticket" rows={4} maxLength={3000} value={input} onChange={e => setInput(e.target.value)} placeholder={zh ? '例如：订单重复扣款，想申请退款。' : 'Example: I was charged twice and need a refund.'} className="rounded border border-zinc-500/40 bg-transparent p-3 text-sm"/>
          <div className="flex flex-wrap gap-2">{(zh ? ['重复扣款', '登录报错', '咨询使用方法'] : ['Duplicate charge', 'Login error', 'Getting started']).map(sample =>
            <button key={sample} className="rounded border border-zinc-500/30 px-2 py-1 text-xs" onClick={() => setInput(sample)}>{sample}</button>)}</div>
          <button disabled={!input.trim() || running} onClick={() => setRun({ text: input.trim(), branch: classify(input), index: 0 })} className="flex items-center justify-center gap-2 rounded bg-violet-600 px-4 py-2 text-white disabled:opacity-45"><Play size={15}/>{running ? (zh ? '运行中' : 'Running') : (zh ? '运行工作流' : 'Run workflow')}</button>
          <div aria-live="polite" className="space-y-2 text-sm">{run && <><p className="mt-3 break-words font-medium">{run.text}</p><ol className="space-y-1 text-zinc-600 dark:text-zinc-400">{route.map(id => <li key={id}>{steps.find(s => s.id === id)?.[lang]}</li>)}</ol>{!running && <p>{branches[run.branch][lang]}</p>}</>}</div>
        </section>
      </div>
    </div>
  </main>
}
