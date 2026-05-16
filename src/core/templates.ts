// 结构化 prompt 构造器 + 平台/目标/风格 模板注册表。
//
// 复利资产:这套「钩子-痛点-价值-CTA」骨架 + 注册表显式可复用于 Q3
// 第二产品 —— 换平台/目标/风格只需扩注册表,prompt 主干不动。
import {
  type GenerationInput,
  type Goal,
  type Platform,
  STYLE_IDS,
  type StyleId,
} from './schema'
import { RedLineError } from './redline'

export interface Profile<Id extends string> {
  id: Id
  label: string
  /** 注入 prompt 的写作指引片段。 */
  guidance: string
}

export const PLATFORM_REGISTRY: Record<Platform, Profile<Platform>> = {
  xiaohongshu: {
    id: 'xiaohongshu',
    label: '小红书图文',
    guidance:
      '小红书图文笔记:首句强钩子抓眼球,口语化、真实体验感,适度 emoji,正文 300-500 字,结尾引导互动收藏,配 5-8 个精准话题标签。',
  },
  douyin_oral: {
    id: 'douyin_oral',
    label: '抖音口播',
    guidance:
      '抖音口播脚本:前 3 秒强钩子留人,口语短句、节奏快、有停顿提示,正文 150-250 字适配 30-45 秒,结尾明确行动指令。',
  },
}

export const GOAL_REGISTRY: Record<Goal, Profile<Goal>> = {
  follow: {
    id: 'follow',
    label: '涨粉',
    guidance: '目标涨粉:放大人设价值与持续关注的理由,CTA 引导关注账号。',
  },
  seed: {
    id: 'seed',
    label: '种草',
    guidance:
      '目标种草:聚焦真实使用场景与可感知体验,建立信任,CTA 引导收藏/试用,不作绝对化效果承诺。',
  },
  convert: {
    id: 'convert',
    label: '转化',
    guidance:
      '目标转化:强化卖点与即时行动理由,CTA 引导下单/咨询,以事实卖点驱动而非夸大。',
  },
}

export const STYLE_REGISTRY: Record<StyleId, Profile<StyleId>> = {
  warm_sharing: {
    id: 'warm_sharing',
    label: '真诚分享体',
    guidance: '语气真诚、像朋友安利,第一人称真实体验,不浮夸。',
  },
  rational_review: {
    id: 'rational_review',
    label: '理性测评体',
    guidance: '客观对比、讲依据、列要点,克制不煽动,可信度优先。',
  },
  punchy_hook: {
    id: 'punchy_hook',
    label: '强钩子爆点体',
    guidance: '开篇制造反差/悬念,节奏紧凑、信息密度高,但不标题党虚假。',
  },
  story_telling: {
    id: 'story_telling',
    label: '故事代入体',
    guidance: '用一个具体场景小故事切入,带入痛点,自然过渡到卖点。',
  },
}

export interface BuiltPrompt {
  system: string
  user: string
}

const SYSTEM_PROMPT = [
  '你是缤果文案台的资深内容策划。严格遵守以下铁律:',
  '1. 【原创铁律】只能基于用户提供的「卖点」与「选题」原创创作。',
  '   严禁洗稿、严禁改写或仿写任何他人已有文章,严禁搬运、',
  '   严禁编造用户未提供的事实、数据、案例或链接。',
  '2. 【合规铁律】不得夸大功效、不得作绝对化或承诺性表述、',
  '   不得涉及医疗诊断/金融荐股/未成年人不宜等违规内容。',
  '3. 【结构铁律】正文严格按「钩子(hook)→ 痛点(painPoint)→',
  '   价值(value)→ 行动号召(cta)」四段式组织。',
  '4. 【输出铁律】只输出一个严格合法的 JSON 对象,无任何额外说明、',
  '   无 markdown 代码围栏,形如:',
  '   {"titles":["...x5..."],"body":{"hook":"...","painPoint":"...",',
  '   "value":"...","cta":"..."},"tags":["...","..."]}',
  '   titles 为 5 个候选标题;tags 为 5-8 个话题标签(不含 # 前缀)。',
].join('\n')

/**
 * 仅依据用户自填输入构造 prompt。不读取/检索任何外部内容。
 * 即便 redline 已校验,本函数对 style 再做一次注册表校验,保证
 * templates 被 T2/T3 单独引用时仍然安全。
 */
export function buildPrompt(input: GenerationInput): BuiltPrompt {
  if (!(STYLE_IDS as readonly string[]).includes(input.style)) {
    throw new RedLineError(
      'invalid_value',
      `style "${input.style}" 未在风格注册表中登记。`,
    )
  }
  const platform = PLATFORM_REGISTRY[input.platform]
  const goal = GOAL_REGISTRY[input.goal]
  const style = STYLE_REGISTRY[input.style]

  const user = [
    '请基于以下【用户自填信息】创作,不得引入任何用户未提供的内容:',
    `- 卖点:${input.sellingPoints}`,
    `- 选题:${input.topic}`,
    `- 平台要求:${platform.guidance}`,
    `- 目标要求:${goal.guidance}`,
    `- 风格要求:${style.guidance}`,
    '',
    '按「钩子 → 痛点 → 价值 → CTA」四段式组织正文,并产出 5 个候选',
    '标题与 5-8 个话题标签。严格按系统指令的 JSON 结构输出。',
  ].join('\n')

  return { system: SYSTEM_PROMPT, user }
}
