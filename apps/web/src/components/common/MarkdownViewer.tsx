import React, { useMemo, useState } from 'react'
import hljs from 'highlight.js'
import { Check, Copy } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const rawCode = String(children || '').replace(/\n$/, '')
  const match = /language-(\w+)/.exec(className || '')
  const lang = match?.[1] || ''

  const highlighted = useMemo(() => {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(rawCode, { language: lang }).value
      }
      return hljs.highlightAuto(rawCode).value
    } catch {
      return rawCode
    }
  }, [rawCode, lang])

  const handleCopy = () => {
    navigator.clipboard.writeText(rawCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-slate-200 dark:border-[#263348] bg-[#0B1018]">
      <div className="flex items-center justify-between border-b border-slate-800 bg-[#121926] px-3 py-1.5 text-[10px] font-mono text-slate-400">
        <span>{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 hover:text-slate-200 transition-colors"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs font-mono leading-relaxed text-slate-200">
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  )
}

export function MarkdownViewer({ content }: { content: string }) {
  return (
    <div className="sf-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...rest }) {
            const isBlock = Boolean(className) || String(children).includes('\n')
            if (!isBlock) {
              return (
                <code className={className} {...rest}>
                  {children}
                </code>
              )
            }
            return <CodeBlock className={className}>{children}</CodeBlock>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
