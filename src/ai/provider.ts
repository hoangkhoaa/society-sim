import type { AIConfig, AIProvider } from '../types'

/** Official Ollama Cloud API host ([docs](https://docs.ollama.com/cloud)). */
export const OLLAMA_CLOUD_DEFAULT_HOST = 'https://ollama.com'

function resolveOllamaCloudRoot(baseUrl: string | undefined): string {
  const trimmed = (baseUrl ?? '').trim()
  const root = trimmed || OLLAMA_CLOUD_DEFAULT_HOST
  return root.replace(/\/$/, '')
}

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

// ── Rate limiter (sliding-window RPM) ────────────────────────────────────
// Tracks timestamps of recent requests; before each callAI, waits if the
// window is full.  `rpm_limit = 0` means no limit.

const _requestTimestamps: number[] = []

function pruneTimestamps() {
  const cutoff = Date.now() - 60_000
  while (_requestTimestamps.length > 0 && _requestTimestamps[0] < cutoff) {
    _requestTimestamps.shift()
  }
}

/** How many more requests can be sent right now without waiting. */
export function getRemainingRPM(rpmLimit: number): number {
  if (rpmLimit <= 0) return Infinity
  pruneTimestamps()
  return Math.max(0, rpmLimit - _requestTimestamps.length)
}

/** Estimated seconds until next slot opens (0 if a slot is available). */
export function getWaitSeconds(rpmLimit: number): number {
  if (rpmLimit <= 0) return 0
  pruneTimestamps()
  if (_requestTimestamps.length < rpmLimit) return 0
  return Math.max(0, (_requestTimestamps[0] + 60_000 - Date.now()) / 1000)
}

/** True if at least `n` requests can fit in the current minute window. */
export function canAfford(rpmLimit: number, n: number): boolean {
  return getRemainingRPM(rpmLimit) >= n
}

async function waitForSlot(rpmLimit: number): Promise<void> {
  if (rpmLimit <= 0) return
  pruneTimestamps()
  while (_requestTimestamps.length >= rpmLimit) {
    const waitMs = _requestTimestamps[0] + 60_000 - Date.now() + 50
    if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs))
    pruneTimestamps()
  }
}

function recordRequest() {
  _requestTimestamps.push(Date.now())
}

interface ProviderDef {
  defaultModel: string
  url: (model: string, key: string, baseUrl: string) => string
  headers: (key: string) => Record<string, string>
  buildBody: (system: string, user: string, model: string, maxTokens: number) => unknown
  parseResponse: (json: unknown) => string
}

const PROVIDERS: Record<AIProvider, ProviderDef> = {
  gemini: {
    defaultModel: 'gemini-2.5-flash',
    // Gemini puts key in URL query param
    url: (model, key, _baseUrl) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    headers: () => ({ 'content-type': 'application/json' }),
    buildBody: (system, user, _model, maxTokens) => ({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
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
    buildBody: (system, user, model, maxTokens) => ({
      model,
      max_tokens: maxTokens,
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
    buildBody: (system, user, model, maxTokens) => ({
      model,
      max_tokens: maxTokens,
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
    buildBody: (system, user, model, maxTokens) => ({
      model,
      stream: false,
      max_tokens: maxTokens,
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

  // Ollama Cloud: native HTTP API on ollama.com — /api/chat (not OpenAI-compatible /v1/chat/completions).
  // Auth: Bearer API key from https://ollama.com/settings/keys
  ollama_cloud: {
    defaultModel: 'gpt-oss:120b',
    url: (_model, _key, baseUrl) => `${resolveOllamaCloudRoot(baseUrl)}/api/chat`,
    headers: (key) => ({
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    }),
    buildBody: (system, user, model, maxTokens) => ({
      model,
      stream: false,
      options: { num_predict: maxTokens },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    parseResponse: (json: unknown) => {
      const j = json as {
        message?: { content?: string }
        prompt_eval_count?: number
        eval_count?: number
      }
      const text = j.message?.content
      if (typeof text !== 'string') {
        throw new Error('Ollama Cloud: missing assistant message in response')
      }
      _totalTokens += (j.prompt_eval_count ?? 0) + (j.eval_count ?? 0)
      return text
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
  // Use "List models" after signing in; see https://ollama.com/search?c=cloud
  ollama_cloud: [
    'gpt-oss:120b',
    'gpt-oss:20b',
  ],
}

export interface ListModelsInput {
  provider: AIProvider
  keys: string[]
  base_url?: string
}

/** Fetch model ids from the provider API when supported; otherwise static list. */
export async function listAvailableModels(input: ListModelsInput): Promise<string[]> {
  const { provider, keys } = input
  
  // Return static list if no keys provided (Ollama local)
  if (keys.length === 0) {
    return PROVIDER_MODELS[provider] ?? []
  }
  
  // Try each key until one works for listing models
  let lastError: Error | null = null
  
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    try {
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
            lastError = new Error(`ListModels ${res.status}: ${t.slice(0, 240)}`)
            break
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
        if (out.length > 0) {
          if (i > 0) console.log(`[AI] Key ${i + 1}/${keys.length} working ✓`)
          return [...new Set(out)].sort()
        }
      } else if (provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        })
        if (!res.ok) {
          const t = await res.text()
          lastError = new Error(`ListModels ${res.status}: ${t.slice(0, 240)}`)
          if (i < keys.length - 1) console.warn(`[AI] Key ${i + 1}/${keys.length} failed, trying next...`)
          continue
        }
        const json = (await res.json()) as { data?: { id: string }[] }
        const skip = /embedding|whisper|dall-e|tts|moderation|davinci|babbage|curie|ada|realtime|transcribe|speech|image|audio|video/i
        const ids = (json.data ?? [])
          .map(d => d.id)
          .filter(id => id && !skip.test(id))
        if (ids.length > 0) {
          if (i > 0) console.log(`[AI] Key ${i + 1}/${keys.length} working ✓`)
          return [...new Set(ids)].sort()
        }
      } else if (provider === 'anthropic') {
        const out: string[] = []
        let after: string | undefined
        let success = false
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
            lastError = new Error(`ListModels ${res.status}: ${t.slice(0, 240)}`)
            break
          }
          success = true
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
        if (success && out.length > 0) {
          if (i > 0) console.log(`[AI] Key ${i + 1}/${keys.length} working ✓`)
          return [...new Set(out)].sort()
        }
      }
      
      if (i < keys.length - 1) {
        console.warn(`[AI] Key ${i + 1}/${keys.length} failed, trying next...`)
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (i < keys.length - 1) {
        console.warn(`[AI] Key ${i + 1}/${keys.length} failed: ${lastError.message.slice(0, 80)}, trying next...`)
      }
    }
  }

  // All keys failed, return static list as fallback
  console.error(`[AI] All keys failed for ${provider}, using static model list`)
  return PROVIDER_MODELS[provider] ?? []
}

// ── Professional API Key Management (Ring Buffer + Health Tracking) ──────
interface KeyHealth {
  key: string
  successCount: number
  failureCount: number
  consecutiveFailures: number
  lastUsed: number
  lastError?: string
  isHealthy: boolean
}

class APIKeyRing {
  private ring: KeyHealth[] = []
  private currentIndex = 0
  private readonly CONSECUTIVE_FAILURE_THRESHOLD = 3
  private readonly COOLDOWN_MS = 30000  // 30 seconds cooldown for failed keys

  init(keys: string[]) {
    this.ring = keys.map(key => ({
      key,
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
      lastUsed: 0,
      isHealthy: true,
    }))
    this.currentIndex = 0
  }

  /**
   * Get next key using health-aware round-robin:
   * - Prefers healthy keys
   * - Rotates through the ring
   * - Respects cooldown periods for failed keys
   */
  getNextKey(): { key: string; index: number } | null {
    if (this.ring.length === 0) return null

    const now = Date.now()
    let attempts = 0
    const maxAttempts = this.ring.length * 2  // Allow extra cycles to find healthy key

    while (attempts < maxAttempts) {
      const health = this.ring[this.currentIndex]
      this.currentIndex = (this.currentIndex + 1) % this.ring.length

      // Check if key is in cooldown
      if (!health.isHealthy && now - health.lastUsed < this.COOLDOWN_MS) {
        attempts++
        continue
      }

      return { key: health.key, index: this.currentIndex - 1 }
    }

    // Fallback: return first key even if unhealthy (cooldown expired)
    return { key: this.ring[0].key, index: 0 }
  }

  recordSuccess(index: number) {
    if (index < 0 || index >= this.ring.length) return
    const health = this.ring[index]
    health.successCount++
    health.consecutiveFailures = 0
    health.isHealthy = true
    health.lastUsed = Date.now()
  }

  recordFailure(index: number, error: string) {
    if (index < 0 || index >= this.ring.length) return
    const health = this.ring[index]
    health.failureCount++
    health.consecutiveFailures++
    health.lastError = error
    health.lastUsed = Date.now()

    if (health.consecutiveFailures >= this.CONSECUTIVE_FAILURE_THRESHOLD) {
      health.isHealthy = false
    }
  }

  getStats() {
    return this.ring.map((h, idx) => ({
      index: idx + 1,
      status: h.isHealthy ? '✓' : '✗',
      success: h.successCount,
      failure: h.failureCount,
      consecutive_fails: h.consecutiveFailures,
      key_preview: `${h.key.slice(0, 8)}...`,
    }))
  }

  formatKeyPreview(key: string): string {
    return `[${key.slice(0, 4)}...${key.slice(-4)}]`
  }
}

const _keyRing = new APIKeyRing()

export function initKeyRing(keys: string[]) {
  _keyRing.init(keys)
}

export function getKeyRingStats() {
  return _keyRing.getStats()
}

export async function callAI(
  config: AIConfig,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 512,
): Promise<string> {
  await waitForSlot(config.rpm_limit ?? 0)

  if (config.keys.length === 0) {
    throw new Error('No API keys provided')
  }

  // Initialize ring on first use
  if (_keyRing.getStats().length === 0) {
    _keyRing.init(config.keys)
  }

  const p = PROVIDERS[config.provider]
  const requestedModel = config.model?.trim()
  const model = requestedModel || p.defaultModel
  const baseUrl = config.base_url ?? ''
  const maxRetriesPerKey = config.keys.length

  let lastError: Error | null = null

  // Try keys from the ring, respecting health status
  for (let attempt = 0; attempt < config.keys.length; attempt++) {
    const next = _keyRing.getNextKey()
    if (!next) break

    const { key, index } = next
    const keyPreview = _keyRing.formatKeyPreview(key)
    let keyRetries = 0

    // Retry this specific key up to maxRetriesPerKey times
    while (keyRetries < maxRetriesPerKey) {
      let countedHttpRoundTrip = false
      try {
        const url = p.url(model, key, baseUrl)
        const headers = p.headers(key)
        const body = p.buildBody(systemPrompt, userMessage, model, maxTokens)

        recordRequest()

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        })
        countedHttpRoundTrip = true
        // Count every completed HTTP round-trip (incl. 4xx/5xx and retries), not only 2xx — matches real API usage.
        _totalRequests++

        if (!res.ok) {
          const err = await res.text()
          const errMsg = `${res.status}: ${err.slice(0, 100)}`
          lastError = new Error(`AI error ${errMsg}`)
          keyRetries++
          _keyRing.recordFailure(index, errMsg)

          if (keyRetries < maxRetriesPerKey) {
            console.warn(
              `[AI] Key ${index + 1}/${config.keys.length} ${keyPreview} retry ${keyRetries}/${maxRetriesPerKey}...`
            )
          } else {
            console.warn(
              `[AI] Key ${index + 1}/${config.keys.length} ${keyPreview} exhausted, rotating...`
            )
          }
          continue
        }

        // Success!
        const json = await res.json()
        _keyRing.recordSuccess(index)

        if (attempt > 0 || keyRetries > 0) {
          console.log(
            `[AI] Key ${index + 1}/${config.keys.length} ${keyPreview} working ✓ (after ${attempt} rotations)`
          )
        }

        return p.parseResponse(json)
      } catch (err) {
        if (!countedHttpRoundTrip) _totalRequests++
        const errMsg = err instanceof Error ? err.message.slice(0, 100) : String(err)
        lastError = err instanceof Error ? err : new Error(String(err))
        keyRetries++
        _keyRing.recordFailure(index, errMsg)

        if (keyRetries < maxRetriesPerKey) {
          console.warn(
            `[AI] Key ${index + 1}/${config.keys.length} ${keyPreview} error: ${errMsg}, retry ${keyRetries}/${maxRetriesPerKey}...`
          )
        } else {
          console.warn(
            `[AI] Key ${index + 1}/${config.keys.length} ${keyPreview} exhausted, rotating...`
          )
        }
      }
    }
  }

  // All keys exhausted - log stats
  console.error(
    `[AI] All keys exhausted. Stats: ${JSON.stringify(_keyRing.getStats())}`
  )
  throw lastError || new Error('All API keys failed')
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
