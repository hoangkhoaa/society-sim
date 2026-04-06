import type { AIConfig, AIProvider } from '../types'

// ── Usage tracking ────────────────────────────────────────────────────────
let _totalRequests = 0
let _totalTokens = 0

export function getAIUsage() {
  return { requests: _totalRequests, tokens: _totalTokens }
}

export function resetAIUsage() {
  _totalRequests = 0
  _totalTokens = 0
}

interface ProviderDef {
  defaultModel: string
  url: (model: string, key: string, baseUrl: string) => string
  headers: (key: string) => Record<string, string>
  buildBody: (system: string, user: string, model: string) => unknown
  parseResponse: (json: unknown) => string
}

const PROVIDERS: Record<AIProvider, ProviderDef> = {
  gemini: {
    defaultModel: 'gemini-2.5-flash',
    // Gemini puts key in URL query param
    url: (model, key, _baseUrl) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    headers: () => ({ 'content-type': 'application/json' }),
    buildBody: (system, user) => ({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    }),
    parseResponse: (json: unknown) => {
      const j = json as { candidates: { content: { parts: { text: string }[] } }[]; usageMetadata?: { totalTokenCount?: number } }
      _totalTokens += j.usageMetadata?.totalTokenCount ?? 0
      return j.candidates[0].content.parts[0].text
    },
  },

  anthropic: {
    defaultModel: 'claude-haiku-4-5-20251001',
    url: (_model, _key, _baseUrl) => 'https://api.anthropic.com/v1/messages',
    headers: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    }),
    buildBody: (system, user, model) => ({
      model,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: user }],
    }),
    parseResponse: (json: unknown) => {
      const j = json as { content: { text: string }[]; usage?: { input_tokens?: number; output_tokens?: number } }
      _totalTokens += (j.usage?.input_tokens ?? 0) + (j.usage?.output_tokens ?? 0)
      return j.content[0].text
    },
  },

  openai: {
    defaultModel: 'gpt-4o-mini',
    url: (_model, _key, _baseUrl) => 'https://api.openai.com/v1/chat/completions',
    headers: (key) => ({
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    }),
    buildBody: (system, user, model) => ({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    parseResponse: (json: unknown) => {
      const j = json as { choices: { message: { content: string } }[]; usage?: { total_tokens?: number } }
      _totalTokens += j.usage?.total_tokens ?? 0
      return j.choices[0].message.content
    },
  },

  ollama: {
    defaultModel: 'llama3.2:3b',
    url: (_model, _key, _baseUrl) => 'http://localhost:11434/v1/chat/completions',
    headers: () => ({ 'content-type': 'application/json' }),
    buildBody: (system, user, model) => ({
      model,
      stream: false,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    parseResponse: (json: unknown) => {
      const j = json as { choices: { message: { content: string } }[]; usage?: { total_tokens?: number } }
      _totalTokens += j.usage?.total_tokens ?? 0
      return j.choices[0].message.content
    },
  },

  ollama_cloud: {
    defaultModel: 'llama3.2:3b',
    url: (_model, _key, baseUrl) => `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`,
    headers: (key) => ({
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    }),
    buildBody: (system, user, model) => ({
      model,
      stream: false,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    parseResponse: (json: unknown) => {
      const j = json as { choices: { message: { content: string } }[]; usage?: { total_tokens?: number } }
      _totalTokens += j.usage?.total_tokens ?? 0
      return j.choices[0].message.content
    },
  },
}

export const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  gemini: [
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
  ],
  anthropic: [
    'claude-haiku-4-5-20251001',
    'claude-3-5-haiku-latest',
  ],
  openai: [
    'gpt-4o-mini',
    'gpt-4.1-mini',
  ],
  ollama: [
    'llama3.2:3b',
    'llama3.2:1b',
    'gemma3:4b',
    'phi4-mini:3.8b',
    'qwen2.5:7b',
  ],
  ollama_cloud: [
    'llama3.2:3b',
    'llama3.2:1b',
    'gemma3:4b',
    'phi4-mini:3.8b',
    'qwen2.5:7b',
  ],
}

export interface ListModelsInput {
  provider: AIProvider
  key: string
  base_url?: string
}

/** Fetch model ids from the provider API when supported; otherwise static list. */
export async function listAvailableModels(input: ListModelsInput): Promise<string[]> {
  const { provider, key, base_url } = input

  if (provider === 'gemini') {
    const out: string[] = []
    let pageToken: string | undefined
    do {
      const url = new URL('https://generativelanguage.googleapis.com/v1beta/models')
      url.searchParams.set('key', key)
      url.searchParams.set('pageSize', '100')
      if (pageToken) url.searchParams.set('pageToken', pageToken)
      const res = await fetch(url.toString())
      if (!res.ok) {
        const t = await res.text()
        throw new Error(`ListModels ${res.status}: ${t.slice(0, 240)}`)
      }
      const json = (await res.json()) as {
        models?: Array<{
          name?: string
          supportedGenerationMethods?: string[]
          supported_generation_methods?: string[]
        }>
        nextPageToken?: string
      }
      for (const m of json.models ?? []) {
        const methods = m.supportedGenerationMethods ?? m.supported_generation_methods ?? []
        if (!methods.includes('generateContent')) continue
        const raw = m.name ?? ''
        const id = raw.replace(/^models\//, '')
        if (id) out.push(id)
      }
      pageToken = json.nextPageToken
    } while (pageToken)
    return [...new Set(out)].sort()
  }

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`ListModels ${res.status}: ${t.slice(0, 240)}`)
    }
    const json = (await res.json()) as { data?: { id: string }[] }
    const skip = /embedding|whisper|dall-e|tts|moderation|davinci|babbage|curie|ada|realtime|transcribe|speech|image|audio|video/i
    const ids = (json.data ?? [])
      .map(d => d.id)
      .filter(id => id && !skip.test(id))
    return [...new Set(ids)].sort()
  }

  if (provider === 'anthropic') {
    const out: string[] = []
    let after: string | undefined
    for (;;) {
      const url = new URL('https://api.anthropic.com/v1/models')
      url.searchParams.set('limit', '100')
      if (after) url.searchParams.set('after_id', after)
      const res = await fetch(url.toString(), {
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(`ListModels ${res.status}: ${t.slice(0, 240)}`)
      }
      const json = (await res.json()) as {
        data?: { id: string }[]
        has_more?: boolean
        last_id?: string
      }
      for (const row of json.data ?? []) {
        if (row.id) out.push(row.id)
      }
      if (!json.has_more || !json.last_id) break
      after = json.last_id
    }
    return [...new Set(out)].sort()
  }

  const ollamaRoot = (() => {
    if (provider === 'ollama') return 'http://localhost:11434'
    const b = (base_url ?? '').replace(/\/$/, '')
    if (!b) throw new Error('Base URL required for Ollama (cloud).')
    return b
  })()

  const headers: Record<string, string> = {}
  if (provider === 'ollama_cloud' && key) headers.Authorization = `Bearer ${key}`

  const res = await fetch(`${ollamaRoot}/api/tags`, { headers })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Ollama tags ${res.status}: ${t.slice(0, 240)}`)
  }
  const json = (await res.json()) as { models?: { name: string }[] }
  return (json.models ?? []).map(m => m.name).filter(Boolean).sort()
}

export async function callAI(
  config: AIConfig,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const p = PROVIDERS[config.provider]
  const requestedModel = config.model?.trim()
  const model = requestedModel || p.defaultModel
  const url = p.url(model, config.key, config.base_url ?? '')
  const headers = p.headers(config.key)
  const body = p.buildBody(systemPrompt, userMessage, model)

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`AI error ${res.status}: ${err.slice(0, 200)}`)
  }

  const json = await res.json()
  _totalRequests++
  return p.parseResponse(json)
}

// Extract JSON object from LLM response (handles markdown fences and extra text)
export function extractJSON(text: string): string {
  // First check for markdown code fences
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) return fence[1].trim()

  // Find the last complete JSON object using brace matching
  const lastBrace = text.lastIndexOf('}')
  if (lastBrace !== -1) {
    let depth = 0
    for (let i = lastBrace; i >= 0; i--) {
      if (text[i] === '}') depth++
      else if (text[i] === '{') {
        depth--
        if (depth === 0) return text.slice(i, lastBrace + 1)
      }
    }
  }

  return text.trim()
}
