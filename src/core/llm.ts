// LLM provider 抽象层。
//
// 设计要点(CMP-5 plan §3 安全约束):
//  - 接口先行,mock 与 real adapter 同一契约 → 无 key 也能全量开发,
//    生产力不停;仅「接真 LLM + 公开上线」两步 gate 在 CEO 审批 (§6)。
//  - 真实 adapter 的 API Key **只能运行时注入** (HttpLlmConfig.apiKey,
//    由 T2 CMP-9 的 Cloudflare Worker secret 提供),**绝不硬编码、
//    绝不入仓** —— 本文件不含任何 key 字面量或默认值。

export interface LlmRequest {
  system: string
  user: string
}

export interface LlmResponse {
  text: string
}

export interface LlmProvider {
  readonly name: string
  complete(req: LlmRequest): Promise<LlmResponse>
}

/**
 * 确定性 mock provider:同输入恒定同输出。返回符合生成契约
 * (titles×5 / body 四段 / tags) 的 JSON,供 T1/T3 在无 key 下开发与
 * 测试。注意:文案为占位骨架,不含任何真实承诺性表述。
 */
export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock'

  async complete(_req: LlmRequest): Promise<LlmResponse> {
    void _req
    const payload = {
      titles: [
        '【示例标题1】真实体验向你安利',
        '【示例标题2】这个点我必须说说',
        '【示例标题3】用过才知道的小细节',
        '【示例标题4】选它之前我也纠结过',
        '【示例标题5】分享给同样需求的你',
      ],
      body: {
        hook: '(mock 钩子) 这是用于本地开发与测试的占位钩子。',
        painPoint: '(mock 痛点) 这里描述用户的真实痛点场景。',
        value: '(mock 价值) 这里基于你填写的卖点说明价值。',
        cta: '(mock CTA) 这里给出克制、不夸大的行动引导。',
      },
      tags: ['示例标签A', '示例标签B', '示例标签C', '示例标签D', '示例标签E'],
    }
    return { text: JSON.stringify(payload) }
  }
}

export interface HttpLlmConfig {
  /** OpenAI 兼容的 chat completions 端点。 */
  baseUrl: string
  /** 运行时注入的 API Key —— 绝不入仓。 */
  apiKey: string
  model: string
  temperature?: number
  /** 可注入的 fetch 实现(测试用);默认 globalThis.fetch。 */
  fetchImpl?: typeof fetch
}

function requireNonBlank(value: string | undefined, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `createHttpLlmProvider: 缺少 "${field}"。Key/端点/模型必须运行时注入,不得入仓。`,
    )
  }
  return value
}

/**
 * 创建 OpenAI 兼容的真实 LLM provider。工厂阶段即强校验:缺 key/
 * 端点/模型直接抛错,且**在抛错前不发起任何网络请求**。
 */
export function createHttpLlmProvider(config: HttpLlmConfig): LlmProvider {
  const baseUrl = requireNonBlank(config.baseUrl, 'baseUrl')
  const apiKey = requireNonBlank(config.apiKey, 'apiKey')
  const model = requireNonBlank(config.model, 'model')
  const temperature = config.temperature ?? 0.8
  const doFetch = config.fetchImpl ?? globalThis.fetch
  if (typeof doFetch !== 'function') {
    throw new Error('createHttpLlmProvider: 运行环境缺少 fetch 实现。')
  }

  return {
    name: 'http',
    async complete(req: LlmRequest): Promise<LlmResponse> {
      const resp = await doFetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
        }),
      })
      if (!resp.ok) {
        const detail = await resp.text().catch(() => '')
        throw new Error(`LLM provider HTTP ${resp.status}: ${detail}`)
      }
      const json = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const text = json.choices?.[0]?.message?.content
      if (typeof text !== 'string') {
        throw new Error('LLM provider 返回缺少 choices[0].message.content。')
      }
      return { text }
    },
  }
}
