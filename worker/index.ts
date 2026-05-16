// 缤果文案台 —— Serverless LLM 代理 (Cloudflare Worker, $0 免费额度)
//
// CMP-9 / T2 (父 CMP-5 §3–§6)。极薄代理。设计要害:
//
//  - LLM API Key 仅作为 Worker secret 服务端持有 (env.LLM_API_KEY),
//    **绝不入客户端 bundle / 仓库 / wrangler.toml**。无 key 时确定性
//    降级到 mock provider —— 仓库内保持 keyless,可对 mock 端到端跑通,
//    真供应商 adapter 同时就绪。接真 key + 公开上线 = CMP-5 §6 board
//    approval gate。
//  - 红线 ①②③ 在服务端**强制兜底**:本代理不自行做输入过滤或免责
//    拼接,而是统一走 T1 复利核心 `createGenerator(...).generate()` ——
//    单一事实来源 = src/core,杜绝代理层各自定义 schema 导致红线失守:
//      ① assertCleanInput   拒绝洗稿/搬运/越界字段 (客户端绕过无效)
//      ② buildPrompt        内置系统 prompt 硬禁改写/洗稿/编造
//      ③ enforceDisclaimer  末尾强制注入免责,调用方不可剥离
//  - 计次信号:每次成功生成发出一条结构化 count 信号 (结构化日志 +
//    响应头 + 响应体),供 T4 (CMP-10) paywall 计量消费。本代理**只发
//    信号、不做计量/支付**(计量归 CMP-10,支付归 CMP-6)。

import {
  createGenerator,
  MockLlmProvider,
  createHttpLlmProvider,
  RedLineError,
  GenerationError,
  renderResult,
} from '../src/core/index'
import type { LlmProvider, GenerationResult } from '../src/core/index'

export interface Env {
  /** LLM API Key —— 仅经 `wrangler secret put LLM_API_KEY` 注入。绝不入仓。 */
  LLM_API_KEY?: string
  /** OpenAI 兼容 chat completions 端点 (非密钥;供应商选定后由 §6 配置)。 */
  LLM_BASE_URL?: string
  /** 模型名 (非密钥)。 */
  LLM_MODEL?: string
  /** 允许跨域的前端来源,逗号分隔;留空用内置默认。 */
  ALLOWED_ORIGINS?: string
}

/** Cloudflare Workers 运行时上下文 (仅取用到的最小子集,免依赖 @cloudflare/workers-types)。 */
export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

/** 单条请求体上限 —— 免费额度下的滥用兜底 (用户自填卖点/选题足够)。 */
const MAX_BODY_BYTES = 16 * 1024

const DEFAULT_ALLOWED_ORIGINS = [
  'https://binguosoft65.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

type ProviderMode = 'mock' | 'http'

/**
 * provider 选择:三项 (key + 端点 + 模型) 齐备才接真供应商;否则确定性
 * 降级到 mock。这使"真 adapter 就绪 (keyless)"与"mock 端到端可跑"
 * 同时成立 —— 仓库零密钥即可全链路验证。
 */
function selectProvider(env: Env): { provider: LlmProvider; mode: ProviderMode } {
  const apiKey = env.LLM_API_KEY?.trim()
  const baseUrl = env.LLM_BASE_URL?.trim()
  const model = env.LLM_MODEL?.trim()
  if (apiKey && baseUrl && model) {
    return {
      provider: createHttpLlmProvider({ baseUrl, apiKey, model }),
      mode: 'http',
    }
  }
  return { provider: new MockLlmProvider(), mode: 'mock' }
}

function allowedOrigins(env: Env): string[] {
  const configured = env.ALLOWED_ORIGINS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return configured && configured.length > 0
    ? configured
    : DEFAULT_ALLOWED_ORIGINS
}

/**
 * CORS:前端是另一来源的 GitHub Pages 静态站。仅对白名单 Origin 回显
 * ACAO;暴露计次响应头供 paywall (T4) 读取。非浏览器调用 (curl/测试)
 * 无 Origin 头 → 不加 CORS 头,请求照常工作。
 */
function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin')
  if (!origin || !allowedOrigins(env).includes(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Expose-Headers': 'X-Binguo-Count',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  })
}

/**
 * 计次信号 —— 每次成功生成发一条。**不含任何 PII**:绝不记录用户自填
 * 的卖点/选题,仅枚举元数据 + provider 模式。Cloudflare 采集 stdout
 * (Logs / Logpush / Analytics Engine) 即得可计量信号;响应头/体同时
 * 携带,供 T4 (CMP-10) 客户端 paywall 计量。
 */
function emitCountSignal(meta: GenerationResult['meta'], mode: ProviderMode): void {
  console.log(
    JSON.stringify({
      evt: 'binguo.generation.count',
      ts: new Date().toISOString(),
      provider: mode,
      platform: meta.platform,
      goal: meta.goal,
      style: meta.style,
      billable: true,
    }),
  )
}

function mapError(err: unknown): { status: number; body: unknown } {
  // 红线 ①② —— 服务端强制拒绝。客户端绕过无效,错误码语义明确以便留痕。
  if (err instanceof RedLineError) {
    return {
      status: 422,
      body: {
        ok: false,
        error: { kind: 'red_line', code: err.code, message: err.message },
      },
    }
  }
  // 上游 LLM 输出无法解析为结构化文案。
  if (err instanceof GenerationError) {
    return {
      status: 502,
      body: { ok: false, error: { kind: 'generation', message: err.message } },
    }
  }
  if (err instanceof SyntaxError) {
    return {
      status: 400,
      body: {
        ok: false,
        error: { kind: 'bad_request', message: '请求体不是合法 JSON。' },
      },
    }
  }
  // 真供应商运行时错误 (HTTP 失败等) —— 视为上游不可用,不泄露内部细节。
  return {
    status: 502,
    body: { ok: false, error: { kind: 'upstream', message: '生成服务暂时不可用,请稍后重试。' } },
  }
}

async function handleGenerate(
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return json(
      { ok: false, error: { kind: 'bad_request', message: '请求体过大。' } },
      413,
      cors,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const { status, body } = mapError(new SyntaxError('invalid json'))
    return json(body, status, cors)
  }

  const { provider, mode } = selectProvider(env)
  try {
    // 红线 ①②③ 全部在此 generate() 内强制执行 —— 代理不旁路。
    const data = await createGenerator(provider).generate(parsed)
    emitCountSignal(data.meta, mode)
    return json(
      {
        ok: true,
        data,
        rendered: renderResult(data), // 末行恒为规范免责 (红线③ 输出尾)
        count: { signal: 'binguo.generation.count', billable: true },
      },
      200,
      { ...cors, 'X-Binguo-Count': '1' },
    )
  } catch (err) {
    const { status, body } = mapError(err)
    return json(body, status, cors)
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url)
    const cors = corsHeaders(request, env)

    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    // 健康检查 —— 不泄露任何密钥;仅暴露当前 provider 模式。
    if (url.pathname === '/health' && request.method === 'GET') {
      const { mode } = selectProvider(env)
      return json(
        { status: 'ok', service: 'binguo-llm-proxy', provider: mode, ts: new Date().toISOString() },
        200,
        cors,
      )
    }

    if (url.pathname === '/generate') {
      if (request.method !== 'POST') {
        return json(
          { ok: false, error: { kind: 'method_not_allowed', message: '仅支持 POST。' } },
          405,
          { ...cors, Allow: 'POST, OPTIONS' },
        )
      }
      return handleGenerate(request, env, cors)
    }

    return json(
      { ok: false, error: { kind: 'not_found', message: '未知路由。' } },
      404,
      cors,
    )
  },
}
