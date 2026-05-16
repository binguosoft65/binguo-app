// LLM provider 抽象层单测。
// 关键安全契约:真实 adapter 的 key 只能运行时注入,绝不入仓/不硬编码。
import { describe, it, expect, vi } from 'vitest'
import {
  MockLlmProvider,
  createHttpLlmProvider,
  type LlmRequest,
} from './llm'

const req: LlmRequest = { system: 'sys', user: 'usr' }

describe('MockLlmProvider (无 key 可建,生产力不停)', () => {
  it('exposes name "mock" and returns a text response', async () => {
    const p = new MockLlmProvider()
    expect(p.name).toBe('mock')
    const res = await p.complete(req)
    expect(typeof res.text).toBe('string')
    expect(res.text.length).toBeGreaterThan(0)
  })

  it('is deterministic (same request → identical output)', async () => {
    const p = new MockLlmProvider()
    const a = await p.complete(req)
    const b = await p.complete(req)
    expect(a.text).toBe(b.text)
  })

  it('returns JSON parseable into the generation contract shape', async () => {
    const p = new MockLlmProvider()
    const parsed = JSON.parse((await p.complete(req)).text)
    expect(Array.isArray(parsed.titles)).toBe(true)
    expect(parsed.titles).toHaveLength(5)
    expect(Object.keys(parsed.body).sort()).toEqual(
      ['cta', 'hook', 'painPoint', 'value'].sort(),
    )
    expect(Array.isArray(parsed.tags)).toBe(true)
  })
})

describe('createHttpLlmProvider (key 不入仓 —— 运行时注入)', () => {
  it('throws when apiKey is missing/blank (no hardcoded/default key)', () => {
    expect(() =>
      createHttpLlmProvider({
        baseUrl: 'https://api.example.com/v1/chat/completions',
        apiKey: '',
        model: 'x',
      }),
    ).toThrow()
    expect(() =>
      createHttpLlmProvider({
        baseUrl: 'https://api.example.com/v1/chat/completions',
        apiKey: '   ',
        model: 'x',
      }),
    ).toThrow()
  })

  it('throws when baseUrl or model is missing', () => {
    expect(() =>
      createHttpLlmProvider({ baseUrl: '', apiKey: 'k', model: 'm' }),
    ).toThrow()
    expect(() =>
      createHttpLlmProvider({ baseUrl: 'https://x', apiKey: 'k', model: '' }),
    ).toThrow()
  })

  it('does NOT attempt any network call when key is missing', () => {
    const fetchImpl = vi.fn()
    try {
      createHttpLlmProvider({
        baseUrl: 'https://x',
        apiKey: '',
        model: 'm',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    } catch {
      /* expected */
    }
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('posts to the configured endpoint with the injected bearer key + model', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '{"ok":true}' } }],
        }),
      } as unknown as Response
    }) as unknown as typeof fetch

    const provider = createHttpLlmProvider({
      baseUrl: 'https://api.example.com/v1/chat/completions',
      apiKey: 'sk-runtime-injected',
      model: 'deepseek-chat',
      fetchImpl: fakeFetch,
    })
    expect(provider.name).not.toBe('mock')

    const res = await provider.complete(req)
    expect(res.text).toBe('{"ok":true}')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.example.com/v1/chat/completions')
    const headers = calls[0].init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer sk-runtime-injected')
    const body = JSON.parse(calls[0].init.body as string)
    expect(body.model).toBe('deepseek-chat')
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' })
    expect(body.messages[1]).toEqual({ role: 'user', content: 'usr' })
  })

  it('throws on a non-ok HTTP response', async () => {
    const fakeFetch = (async () =>
      ({
        ok: false,
        status: 429,
        text: async () => 'rate limited',
      }) as unknown as Response) as unknown as typeof fetch
    const provider = createHttpLlmProvider({
      baseUrl: 'https://api.example.com/v1/chat/completions',
      apiKey: 'k',
      model: 'm',
      fetchImpl: fakeFetch,
    })
    await expect(provider.complete(req)).rejects.toThrow(/429/)
  })
})
