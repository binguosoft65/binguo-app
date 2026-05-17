// 计费层闸位 —— 单一事实来源 (CMP-10 / T4).
//
// 复利资产 (显式标注): 这套「计费层 + 锁定能力注册表 + 闸位判定 +
// 免费层正文收敛」与具体产品无耦合, Q3 第二数字产品可直接复用 ——
// 换产品只需调 FREE_DAILY_LIMIT / 文案与新增锁定能力, 闸逻辑不动。
//
// 边界 (本轨范围): 本模块只决定「什么被 gate / 免费层有多少额度」,
// 不做任何收银/支付。真实支付集成 = 下游 CMP-6。
import type { GenerationBody } from './generate'

/** 计费层。免费层带署名水印 + 短正文 + 每日限次; 付费层全解锁。 */
export type Tier = 'free' | 'paid'

/**
 * 锁定层闸位 —— 四项付费能力 (CMP-10 范围):
 *  - unlimited              无限次生成 (免费层每日 3 次)
 *  - long_body              完整长正文 (免费层为短正文预览)
 *  - template_library       风格/行业模板库 (免费层仅基础风格)
 *  - watermark_free_export  去署名水印导出 (免费层导出恒带分发楔子)
 */
export type LockedCapability =
  | 'unlimited'
  | 'long_body'
  | 'template_library'
  | 'watermark_free_export'

export interface Capability {
  id: LockedCapability
  /** 闸位短标题 (按钮/弹层用)。 */
  label: string
  /** 解锁后能得到什么 (paywall 卖点行)。 */
  desc: string
}

/** 免费层每日生成额度。耗尽即触发 paywall 闸 (无限次=锁定能力)。 */
export const FREE_DAILY_LIMIT = 3

/** 免费层每段正文最多展示的字符数 (超出收敛为短正文 + 省略号)。 */
export const FREE_BODY_PREVIEW_CHARS = 60

export const LOCKED_CAPABILITY_IDS = [
  'unlimited',
  'long_body',
  'template_library',
  'watermark_free_export',
] as const

export const LOCKED_CAPABILITIES: Record<LockedCapability, Capability> = {
  unlimited: {
    id: 'unlimited',
    label: '无限次生成',
    desc: '解除每日 3 次限制,想生成多少条就生成多少条。',
  },
  long_body: {
    id: 'long_body',
    label: '完整长正文',
    desc: '输出不截断的完整结构化长正文,免费层仅展示短预览。',
  },
  template_library: {
    id: 'template_library',
    label: '风格 / 行业模板库',
    desc: '解锁更多写作风格与行业专用模板,免费层仅基础风格。',
  },
  watermark_free_export: {
    id: 'watermark_free_export',
    label: '去水印导出',
    desc: '导出不带「缤果文案台」署名,适合直接用于商用场景。',
  },
}

/**
 * 该能力对当前计费层是否被 gate。
 * 免费层: 全部锁定; 付费层 (占位): 全部解锁。
 */
export function isCapabilityLocked(
  _capability: LockedCapability,
  tier: Tier,
): boolean {
  return tier !== 'paid'
}

/** 当前计费层已解锁的能力 id 列表。 */
export function unlockedCapabilities(tier: Tier): LockedCapability[] {
  return LOCKED_CAPABILITY_IDS.filter(
    (id) => !isCapabilityLocked(id, tier),
  )
}

function clampSection(text: string): string {
  if (text.length <= FREE_BODY_PREVIEW_CHARS) return text
  return `${text.slice(0, FREE_BODY_PREVIEW_CHARS)}…`
}

/**
 * 按计费层收敛正文。免费层 = 短正文 (每段截断 + 省略号);
 * 付费层 = 原样 (完整长正文是锁定能力)。返回新对象, 不改入参。
 */
export function clampBodyForTier(
  body: GenerationBody,
  tier: Tier,
): GenerationBody {
  if (tier === 'paid') return { ...body }
  return {
    hook: clampSection(body.hook),
    painPoint: clampSection(body.painPoint),
    value: clampSection(body.value),
    cta: clampSection(body.cta),
  }
}
