// 复利生成核心 —— LLM 编排脚手架。
//
// 编排不可变次序(安全要害):
//   1. assertCleanInput  红线①② 守门(在调用 provider 之前)
//   2. buildPrompt       仅依据用户自填输入构造
//   3. provider.complete 调用 LLM(mock 或 real)
//   4. parseLlmJson      解析为结构化结果
//   5. enforceDisclaimer 红线③ 末尾强制注入(覆盖任何 provider 输出)
//
// T2(CMP-9 serverless 代理)在服务端复用本编排做兜底;T3(CMP-8 UI)
// 经此取结构化结果。
import type { Goal, Platform, StyleId } from './schema'
import { assertCleanInput, enforceDisclaimer } from './redline'
import { RED_LINE_DISCLAIMER } from './schema'
import { buildPrompt } from './templates'
import type { LlmProvider } from './llm'

export interface GenerationBody {
  hook: string
  painPoint: string
  value: string
  cta: string
}

export interface GenerationResult {
  titles: string[]
  body: GenerationBody
  tags: string[]
  /** 恒等于 RED_LINE_DISCLAIMER —— 红线③,调用方/模型不可覆盖。 */
  disclaimer: string
  meta: { platform: Platform; goal: Goal; style: StyleId }
}

export class GenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GenerationError'
  }
}

export interface Generator {
  generate(rawInput: unknown): Promise<GenerationResult>
}

function stripFence(text: string): string {
  const t = text.trim()
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fence ? fence[1].trim() : t
}

function asStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback
  return value.filter((v): v is string => typeof v === 'string')
}

function parseLlmJson(raw: string): {
  titles: string[]
  body: GenerationBody
  tags: string[]
} {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripFence(raw))
  } catch {
    throw new GenerationError('LLM 输出不是合法 JSON,无法解析为结构化文案。')
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new GenerationError('LLM 输出不是对象。')
  }
  const obj = parsed as Record<string, unknown>
  const b = (obj.body ?? {}) as Record<string, unknown>
  return {
    titles: asStringArray(obj.titles),
    body: {
      hook: typeof b.hook === 'string' ? b.hook : '',
      painPoint: typeof b.painPoint === 'string' ? b.painPoint : '',
      value: typeof b.value === 'string' ? b.value : '',
      cta: typeof b.cta === 'string' ? b.cta : '',
    },
    tags: asStringArray(obj.tags),
  }
}

export function createGenerator(provider: LlmProvider): Generator {
  return {
    async generate(rawInput: unknown): Promise<GenerationResult> {
      // 1. 红线①② —— 必须在任何 provider 调用之前
      const input = assertCleanInput(rawInput)
      // 2. 仅依据用户自填输入
      const prompt = buildPrompt(input)
      // 3. 调用 LLM
      const { text } = await provider.complete(prompt)
      // 4. 解析
      const { titles, body, tags } = parseLlmJson(text)
      // 5. 红线③ —— 末尾强制免责,覆盖任何模型/调用方输出
      return enforceDisclaimer({
        titles,
        body,
        tags,
        meta: {
          platform: input.platform,
          goal: input.goal,
          style: input.style,
        },
      }) as GenerationResult
    },
  }
}

/**
 * 渲染为可直接复制的纯文本,**末行恒为规范免责文案**(红线③ 输出尾)。
 * UI(T3)可直接复用本函数,免责无法被前端剥离。
 */
export function renderResult(result: GenerationResult): string {
  const lines = [
    '【候选标题】',
    ...result.titles.map((t, i) => `${i + 1}. ${t}`),
    '',
    '【正文】',
    result.body.hook,
    result.body.painPoint,
    result.body.value,
    result.body.cta,
    '',
    `【标签】${result.tags.map((t) => `#${t}`).join(' ')}`,
    '',
    RED_LINE_DISCLAIMER,
  ]
  return lines.join('\n')
}
