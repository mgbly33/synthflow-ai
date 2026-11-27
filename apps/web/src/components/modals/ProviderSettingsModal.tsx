import { useEffect, useState } from 'react'
import { CheckCircle2, Cpu, KeyRound, Loader2, Shield, Sparkles, Wifi, X, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { useStudioStore } from '../../store/useStudioStore'
import type { ProviderTestResult } from '../../types/workflow'

const PROVIDER_PRESETS = [
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: 'Qwen (DashScope)', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { name: 'Ollama (Local)', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:7b' },
]

export function ProviderSettingsModal() {
  const { t } = useTranslation()
  const isOpen = useStudioStore((s) => s.isSettingsOpen)
  const setOpen = useStudioStore((s) => s.setSettingsOpen)
  const providerConfig = useStudioStore((s) => s.providerConfig)
  const setProviderConfig = useStudioStore((s) => s.setProviderConfig)
  const showToast = useStudioStore((s) => s.showToast)

  const [mode, setMode] = useState<'DEMO' | 'OPENAI_COMPAT'>('DEMO')
  const [name, setName] = useState('SynthFlow Demo Engine')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [defaultModel, setDefaultModel] = useState('deepseek-chat')
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null)

  useEffect(() => {
    if (providerConfig && isOpen) {
      setMode(providerConfig.provider_mode)
      setName(providerConfig.name)
      setBaseUrl(providerConfig.base_url)
      setDefaultModel(providerConfig.default_model)
      setApiKey('')
      setTestResult(null)
    }
  }, [providerConfig, isOpen])

  if (!isOpen) return null

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const updated = await api.updateProviderConfig({
        name,
        provider_mode: mode,
        base_url: baseUrl,
        api_key: apiKey.trim() ? apiKey.trim() : null,
        default_model: defaultModel,
      })
      setProviderConfig(updated)
      showToast(
        mode === 'DEMO' ? '已切换至内置免 Key 演示引擎' : '大模型配置已通过 Fernet 加密保存',
        'success',
      )
      setOpen(false)
    } catch (err) {
      showToast((err as Error).message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleTest = async () => {
    if (!baseUrl.trim()) {
      setTestResult({ ok: false, latency_ms: 0, message: '请先填写 Base URL' })
      return
    }
    setIsTesting(true)
    setTestResult(null)
    try {
      const res = await api.testProvider({
        base_url: baseUrl.trim(),
        api_key: apiKey.trim() || null,
        model: defaultModel.trim() || 'gpt-4o-mini',
      })
      setTestResult(res)
    } catch (err) {
      setTestResult({ ok: false, latency_ms: 0, message: (err as Error).message })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 dark:border-[#263348] bg-white dark:bg-[#111722] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#222D40] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-violet-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('providerTitle')}</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E293B]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Mode Selector Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode('DEMO')}
              className={[
                'text-left rounded-xl border p-3.5 transition-all',
                mode === 'DEMO'
                  ? 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30'
                  : 'border-slate-200 dark:border-[#243044] hover:border-slate-300 dark:hover:border-slate-600',
              ].join(' ')}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <span>{t('modeDemo')}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                {t('modeDemoDesc')}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode('OPENAI_COMPAT')}
              className={[
                'text-left rounded-xl border p-3.5 transition-all',
                mode === 'OPENAI_COMPAT'
                  ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30'
                  : 'border-slate-200 dark:border-[#243044] hover:border-slate-300 dark:hover:border-slate-600',
              ].join(' ')}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <KeyRound className="h-4 w-4 text-emerald-500" />
                <span>{t('modeReal')}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                {t('modeRealDesc')}
              </p>
            </button>
          </div>

          {/* OpenAI Compatible Settings */}
          {mode === 'OPENAI_COMPAT' && (
            <div className="space-y-3.5 rounded-xl border border-slate-200 dark:border-[#243044] bg-slate-50/70 dark:bg-[#0E141E] p-4">
              <div>
                <div className="mb-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {t('quickPresets')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PROVIDER_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => {
                        setName(p.name)
                        setBaseUrl(p.baseUrl)
                        setDefaultModel(p.model)
                      }}
                      className="rounded-lg border border-slate-200 dark:border-[#2A374E] bg-white dark:bg-[#151D2B] hover:border-violet-500 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {t('baseUrl')}
                </label>
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.deepseek.com/v1"
                  className="w-full rounded-lg border border-slate-200 dark:border-[#27344A] bg-white dark:bg-[#0D1117] px-3 py-2 font-mono text-xs outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <span>{t('apiKey')}</span>
                    {providerConfig?.has_api_key && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-500">
                        <Shield className="h-3 w-3" />
                        {providerConfig.masked_api_key}
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={
                      providerConfig?.has_api_key
                        ? `留空保持已加密密钥 (${providerConfig.masked_api_key})`
                        : 'sk-...'
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-[#27344A] bg-white dark:bg-[#0D1117] px-3 py-2 font-mono text-xs outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {t('defaultModel')}
                  </label>
                  <input
                    value={defaultModel}
                    onChange={(e) => setDefaultModel(e.target.value)}
                    placeholder="deepseek-chat / gpt-4o-mini"
                    className="w-full rounded-lg border border-slate-200 dark:border-[#27344A] bg-white dark:bg-[#0D1117] px-3 py-2 font-mono text-xs outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {/* Test Connection */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={isTesting}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#2A374E] bg-white dark:bg-[#151D2B] hover:bg-slate-100 dark:hover:bg-[#1E293B] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 disabled:opacity-50"
                >
                  {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5 text-indigo-400" />}
                  <span>{t('testConnection')}</span>
                </button>

                {testResult && (
                  <div
                    className={[
                      'flex items-center gap-1.5 text-xs font-medium truncate',
                      testResult.ok ? 'text-emerald-500' : 'text-rose-500',
                    ].join(' ')}
                  >
                    {testResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                    <span className="truncate">
                      {testResult.message} ({testResult.latency_ms}ms)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-[#222D40] px-5 py-3">
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1C2536]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-violet-600/25 disabled:opacity-50"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{t('saveConfig')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
