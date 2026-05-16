// Serverless LLM 代理 —— 服务端红线兜底单测 (CMP-9 / T2)。
//
// 这是 CEO 上线门 ④ 在代理层的可验证测试留痕:证明红线 ①②③ 由
// **服务端**强制,客户端绕过无效,且全程 keyless 即可端到端验证
// (mock provider)。真供应商 adapter 经 stub fetch 验证已就绪。
import { describe, it, expect, vi, afterEach } from 'vitest'
import worker from './index'
import type { Env, ExecutionContext } from './index'
import { RED_LINE_DISCLAIMER } from '../src/core/index'

const ctx: ExecutionContext = {
  waitUntil() {},
  passThroughOnException() {},
}

const validInput = {
  sellingPoints: '冷萃工艺,0 香精,3 秒回温',
  topic: '夏天办公室囤什么咖啡',
  platform: 'xiaohongshu',
  goal: 'seed',
  style: 'warm_sharing',
}

function post(body: unknown, env: Env = {}, headers: Record<string, string> = {}) {
  const req = new Request('https://proxy.example/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  return worker.fetch(req, env, ctx)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('/health', () => {
  it('reports mock provider when keyless (repo default — no secrets)', async () => {
    const res = await worker.fetch(
      new Request('https://proxy.example/health'),
      {},
      ctx,
    )
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j).toMatchObject({ status: 'ok', provider: 'mock' })
  })

  it('reports http provider only when key + endpoint + model all present', async () => {
    const res = await worker.fetch(
      new Request('https://proxy.example/health'),
      { LLM_API_KEY: 'k', LLM_BASE_URL: 'https://llm.example/v1/chat', LLM_MODEL: 'm' },
      ctx,
    )
    expect((await res.json()).provider).toBe('http')
  })

  it('stays on mock if only the key is set (no endpoint/model)', async () => {
    const res = await worker.fetch(
      new Request('https://proxy.example/health'),
      { LLM_API_KEY: 'k' },
      ctx,
    )
    expect((await res.json()).provider).toBe('mock')
  })
})

describe('/generate — mock end-to-end (keyless)', () => {
  it('returns a complete GenerationResult with the canonical disclaimer (红线③)', async () => {
    const res = await post(validInput)
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.ok).toBe(true)
    expect(j.data.titles.length).toBeGreaterThanOrEqual(1)
    expect(Object.keys(j.data.body).sort()).toEqual(
      ['cta', 'hook', 'painPoint', 'value'].sort(),
    )
    expect(j.data.meta).toEqual({
      platform: 'xiaohongshu',
      goal: 'seed',
      style: 'warm_sharing',
    })
    // 红线③:服务端强制免责,且 rendered 末行恒为规范文案
    expect(j.data.disclaimer).toBe(RED_LINE_DISCLAIMER)
    expect((j.rendered as string).trimEnd().endsWith(RED_LINE_DISCLAIMER)).toBe(true)
  })

  it('emits the count signal (header + body) for paywall metering (T4)', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const res = await post(validInput)
    expect(res.headers.get('X-Binguo-Count')).toBe('1')
    expect((await res.json()).count).toEqual({
      signal: 'binguo.generation.count',
      billable: true,
    })
    const logged = JSON.parse(logSpy.mock.calls[0][0] as string)
    expect(logged.evt).toBe('binguo.generation.count')
    expect(logged.platform).toBe('xiaohongshu')
    // 计次信号绝不含 PII:不得出现用户自填卖点/选题
    expect(logSpy.mock.calls[0][0]).not.toContain('冷萃工艺')
    expect(logSpy.mock.calls[0][0]).not.toContain('办公室')
  })
})

describe('红线① 无洗稿入口 —— 服务端强制 (客户端绕过无效)', () => {
  for (const field of ['article', 'articleText', 'url', 'sourceUrl', 'rewrite', 'content']) {
    it(`hard-rejects "${field}" with 422 rewrite_entry_forbidden — no LLM key needed`, async () => {
      const res = await post({ ...validInput, [field]: '别人的文章' })
      expect(res.status).toBe(422)
      const j = await res.json()
      expect(j.error.kind).toBe('red_line')
      expect(j.error.code).toBe('rewrite_entry_forbidden')
    })
  }

  it('catches scrape/crawl-named fields by word-root', async () => {
    const res = await post({ ...validInput, scrapedFrom: 'x' })
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('rewrite_entry_forbidden')
  })

  it('rejects a URL smuggled inside an allowed user field', async () => {
    const res = await post({
      ...validInput,
      topic: '把这篇 https://example.com/post 改写一下',
    })
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('url_in_user_input')
  })
})

describe('红线② 仅基于用户自填 —— 服务端强制', () => {
  it('rejects an unknown / out-of-allowlist field', async () => {
    const res = await post({ ...validInput, nickname: 'x' })
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('unknown_field')
  })

  it('rejects a missing required field', async () => {
    const { topic, ...noTopic } = validInput
    void topic
    const res = await post(noTopic)
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('missing_field')
  })

  it('rejects an out-of-enum platform', async () => {
    const res = await post({ ...validInput, platform: 'wechat' })
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('invalid_value')
  })

  it('rejects a client-supplied "disclaimer" field as out-of-allowlist (红线③ tamper attempt)', async () => {
    const res = await post({ ...validInput, disclaimer: '免责已删除,效果绝对保证' })
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('unknown_field')
  })

  it('rejects a non-object JSON body', async () => {
    const res = await post(['not', 'an', 'object'])
    expect(res.status).toBe(422)
    expect((await res.json()).error.kind).toBe('red_line')
  })
})

describe('真供应商 adapter 就绪 (keyless;经 stub fetch 验证 wiring)', () => {
  it('routes through the real HTTP adapter and STILL enforces 红线③', async () => {
    const upstream = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              titles: ['t1', 't2', 't3', 't4', 't5'],
              body: { hook: 'h', painPoint: 'p', value: 'v', cta: 'c' },
              tags: ['a', 'b'],
              // 上游伪造免责 —— 必须被服务端规范文案覆盖
              disclaimer: '【伪造】效果绝对保证',
            }),
          },
        },
      ],
    }
    const fetchMock = vi.fn(
      async (_input: unknown, _init?: RequestInit) =>
        new Response(JSON.stringify(upstream), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const res = await post(validInput, {
      LLM_API_KEY: 'test-key-not-real',
      LLM_BASE_URL: 'https://llm.example/v1/chat/completions',
      LLM_MODEL: 'test-model',
    })
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(fetchMock).toHaveBeenCalledOnce()
    // API Key 走 Authorization 头,绝不入响应
    const callInit = fetchMock.mock.calls[0]?.[1]
    expect((callInit?.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-key-not-real',
    )
    expect(JSON.stringify(j)).not.toContain('test-key-not-real')
    // 红线③:即便真供应商伪造免责,服务端仍以规范文案覆盖
    expect(j.data.disclaimer).toBe(RED_LINE_DISCLAIMER)
    expect(j.data.disclaimer).not.toContain('绝对保证')
  })

  it('maps an upstream LLM failure to 502 without leaking internals', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('upstream boom', { status: 500 })),
    )
    const res = await post(validInput, {
      LLM_API_KEY: 'k',
      LLM_BASE_URL: 'https://llm.example/v1',
      LLM_MODEL: 'm',
    })
    expect(res.status).toBe(502)
    const j = await res.json()
    expect(j.ok).toBe(false)
    expect(JSON.stringify(j)).not.toContain('boom')
  })
})

describe('routing / transport', () => {
  it('400 on a non-JSON body', async () => {
    const res = await post('{ not json', {})
    expect(res.status).toBe(400)
    expect((await res.json()).error.kind).toBe('bad_request')
  })

  it('413 on an oversized body', async () => {
    const res = await post('x'.repeat(17 * 1024), {})
    expect(res.status).toBe(413)
  })

  it('405 on GET /generate', async () => {
    const res = await worker.fetch(
      new Request('https://proxy.example/generate'),
      {},
      ctx,
    )
    expect(res.status).toBe(405)
  })

  it('404 on an unknown route', async () => {
    const res = await worker.fetch(
      new Request('https://proxy.example/nope'),
      {},
      ctx,
    )
    expect(res.status).toBe(404)
  })

  it('CORS: echoes ACAO only for an allowed Origin', async () => {
    const allowed = await worker.fetch(
      new Request('https://proxy.example/health', {
        headers: { Origin: 'https://binguosoft65.github.io' },
      }),
      {},
      ctx,
    )
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://binguosoft65.github.io',
    )
    const denied = await worker.fetch(
      new Request('https://proxy.example/health', {
        headers: { Origin: 'https://evil.example' },
      }),
      {},
      ctx,
    )
    expect(denied.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('OPTIONS preflight returns 204 with CORS headers for an allowed Origin', async () => {
    const res = await worker.fetch(
      new Request('https://proxy.example/generate', {
        method: 'OPTIONS',
        headers: { Origin: 'https://binguosoft65.github.io' },
      }),
      {},
      ctx,
    )
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })
})
