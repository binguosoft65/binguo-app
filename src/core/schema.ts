// 生成入参契约 —— 单一事实来源 (single source of truth).
//
// 本文件刻意只含纯常量与类型,无任何运行时依赖,以便红线守门、prompt
// 构造、serverless 代理 (CMP-9 / T2) 与 UI (CMP-8 / T3) 共同引用同一份
// 契约,杜绝各处各自定义 schema 导致红线失守。

/** 支持的内容平台。封闭枚举 —— 不在此列即拒绝 (红线②)。 */
export const PLATFORMS = ['xiaohongshu', 'douyin_oral'] as const
export type Platform = (typeof PLATFORMS)[number]

/** 内容目标:涨粉 / 种草 / 转化。封闭枚举。 */
export const GOALS = ['follow', 'seed', 'convert'] as const
export type Goal = (typeof GOALS)[number]

/** 风格 id。注册表 (templates.ts) 必须恰好覆盖这些 id,无孤儿。 */
export const STYLE_IDS = [
  'warm_sharing', // 真诚分享体
  'rational_review', // 理性测评体
  'punchy_hook', // 强钩子爆点体
  'story_telling', // 故事代入体
] as const
export type StyleId = (typeof STYLE_IDS)[number]

/** 唯一合法的生成入参:全部为用户自填,无任何抓取/检索/改写字段。 */
export interface GenerationInput {
  /** 用户自填卖点(产品/服务的真实卖点)。 */
  sellingPoints: string
  /** 用户自填选题。 */
  topic: string
  platform: Platform
  goal: Goal
  style: StyleId
}

/** 红线② —— 入参白名单。出现任何白名单外字段一律硬拒绝。 */
export const ALLOWED_FIELDS = [
  'sellingPoints',
  'topic',
  'platform',
  'goal',
  'style',
] as const

/**
 * 红线① —— 洗稿/搬运 字段显式黑名单。优先于通用 unknown_field 判定,
 * 使「试图粘贴他人文章/URL/要求改写」的违规在测试留痕里语义明确。
 * 大小写不敏感;另对取值做 URL 侦测兜底 (见 redline.ts)。
 */
export const FORBIDDEN_FIELDS = [
  'article',
  'articletext',
  'url',
  'sourceurl',
  'source',
  'link',
  'links',
  'rewrite',
  'rewritefrom',
  'paraphrase',
  'original',
  'originaltext',
  'reference',
  'referencetext',
  'content',
  'html',
  'text',
  'body',
  'excerpt',
  'quote',
  'fromurl',
  'crawl',
  'scrape',
  'fetchurl',
] as const

/**
 * 红线③ —— 固定免责文案。服务端/编排层强制注入到输出,调用方不可覆盖
 * 或剥离。措辞经 CEO 上线门校准:核实信息、勿夸大功效、不承诺效果。
 */
export const RED_LINE_DISCLAIMER =
  '⚠️ 本文由 AI 依据您填写的卖点与选题原创生成,不构成专业建议;请自行核实信息真实性,切勿夸大功效或作绝对化承诺,实际效果因人而异。'
