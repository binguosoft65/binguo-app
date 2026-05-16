// 红线守门模块 (red-line gatekeeper) —— 复利生成核心的安全闸。
//
// 这是整个产品的合规要害:任何生成请求必须先过此门。三条红线对应
// CMP-5 plan §5,且每条都有可验证测试留痕 (redline.test.ts),满足
// CEO 上线门 ④。T2 (CMP-9 serverless 代理) 在服务端复用同一模块做
// 兜底,客户端绕过亦无效。
import {
  ALLOWED_FIELDS,
  FORBIDDEN_FIELDS,
  GOALS,
  type GenerationInput,
  type Goal,
  PLATFORMS,
  type Platform,
  RED_LINE_DISCLAIMER,
  STYLE_IDS,
  type StyleId,
} from './schema'

export { RED_LINE_DISCLAIMER } from './schema'

export type RedLineCode =
  | 'rewrite_entry_forbidden' // 红线① 洗稿/搬运 字段
  | 'url_in_user_input' // 红线① 取值里夹带 URL
  | 'unknown_field' // 红线② 白名单外字段
  | 'missing_field' // 红线② 缺必填
  | 'invalid_value' // 红线② 类型/枚举/空值非法

export class RedLineError extends Error {
  readonly code: RedLineCode
  constructor(code: RedLineCode, message: string) {
    super(message)
    this.name = 'RedLineError'
    this.code = code
  }
}

const FORBIDDEN_SET = new Set<string>(FORBIDDEN_FIELDS)
// 即便字段名不在精确黑名单,只要包含这些词根也按洗稿入口拒绝。
const FORBIDDEN_ROOTS = [
  'article',
  'url',
  'rewrite',
  'original',
  'paraphrase',
  'crawl',
  'scrape',
  'sourcetext',
  '洗稿',
  '改写',
  '搬运',
]
const URL_PATTERN = /(https?:\/\/|www\.)/i
const FREE_TEXT_FIELDS = ['sellingPoints', 'topic'] as const

function isForbiddenKey(key: string): boolean {
  const k = key.toLowerCase()
  if (FORBIDDEN_SET.has(k)) return true
  return FORBIDDEN_ROOTS.some((root) => k.includes(root))
}

/** 红线① —— 拒绝任何洗稿/搬运/改写入口字段。 */
export function checkNoRewriteEntry(raw: Record<string, unknown>): void {
  for (const key of Object.keys(raw)) {
    if (isForbiddenKey(key)) {
      throw new RedLineError(
        'rewrite_entry_forbidden',
        `红线①:禁止洗稿/搬运/改写入口,拒绝字段 "${key}"。生成只能基于你自己填写的卖点与选题。`,
      )
    }
  }
}

/** 红线② —— 入参只能是用户自填白名单字段,且类型/枚举/非空合法。 */
export function checkOnlyUserFilled(
  raw: Record<string, unknown>,
): GenerationInput {
  for (const key of Object.keys(raw)) {
    if (!(ALLOWED_FIELDS as readonly string[]).includes(key)) {
      throw new RedLineError(
        'unknown_field',
        `红线②:仅接受用户自填字段 (${ALLOWED_FIELDS.join(
          ', ',
        )}),拒绝越界字段 "${key}"。本产品不抓取/检索任何外部内容。`,
      )
    }
  }

  for (const field of ALLOWED_FIELDS) {
    if (!(field in raw) || raw[field] === undefined || raw[field] === null) {
      throw new RedLineError('missing_field', `红线②:缺少必填字段 "${field}"。`)
    }
    if (typeof raw[field] !== 'string') {
      throw new RedLineError(
        'invalid_value',
        `红线②:字段 "${field}" 必须为字符串。`,
      )
    }
  }

  const sellingPoints = (raw.sellingPoints as string).trim()
  const topic = (raw.topic as string).trim()
  if (sellingPoints.length === 0 || topic.length === 0) {
    throw new RedLineError(
      'invalid_value',
      '红线②:卖点与选题必须由用户真实填写,不可为空。',
    )
  }

  const platform = raw.platform as string
  if (!(PLATFORMS as readonly string[]).includes(platform)) {
    throw new RedLineError(
      'invalid_value',
      `红线②:platform 非法,仅支持 ${PLATFORMS.join(' / ')}。`,
    )
  }

  const goal = raw.goal as string
  if (!(GOALS as readonly string[]).includes(goal)) {
    throw new RedLineError(
      'invalid_value',
      `红线②:goal 非法,仅支持 ${GOALS.join(' / ')}。`,
    )
  }

  const style = raw.style as string
  if (!(STYLE_IDS as readonly string[]).includes(style)) {
    throw new RedLineError(
      'invalid_value',
      `红线②:style 非法,仅支持 ${STYLE_IDS.join(' / ')}。`,
    )
  }

  // 红线① 兜底:即便字段名合法,也不允许在自由文本里夹带 URL
  // (例如 topic = "把这篇 https://… 改写一下")。
  for (const field of FREE_TEXT_FIELDS) {
    if (URL_PATTERN.test(raw[field] as string)) {
      throw new RedLineError(
        'url_in_user_input',
        `红线①:字段 "${field}" 含 URL 链接。本产品不读取/改写任何链接内容,请仅描述你自己的卖点与选题。`,
      )
    }
  }

  return {
    sellingPoints,
    topic,
    platform: platform as Platform,
    goal: goal as Goal,
    style: style as StyleId,
  }
}

/**
 * 复合守门:任何生成入口都必须先调用本函数。先查红线①(洗稿入口,
 * 优先级最高,语义最明确),再查红线②(白名单/类型/枚举)。
 * 通过后返回经清洗、类型收敛的 GenerationInput。
 */
export function assertCleanInput(raw: unknown): GenerationInput {
  if (
    typeof raw !== 'object' ||
    raw === null ||
    Array.isArray(raw)
  ) {
    throw new RedLineError(
      'invalid_value',
      '红线②:入参必须是一个对象 (用户自填卖点/选题/平台/目标/风格)。',
    )
  }
  const obj = raw as Record<string, unknown>
  checkNoRewriteEntry(obj)
  return checkOnlyUserFilled(obj)
}

/**
 * 红线③ —— 强制免责注入。无论调用方传入什么(空、被篡改、被删除),
 * 一律以 RED_LINE_DISCLAIMER 覆盖,调用方无法绕过或剥离。
 */
export function enforceDisclaimer<T extends Record<string, unknown>>(
  result: T,
): T & { disclaimer: string } {
  return { ...result, disclaimer: RED_LINE_DISCLAIMER }
}
