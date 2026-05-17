// 免费层署名水印 —— 分发楔子 (distribution wedge).
//
// 产品红线之外的「增长不可砍项」(CMP-8 范围): 免费层每次生成的可复制
// 文本都必须带上「缤果文案台」署名,作为内容被转发时的自然获客入口。
// 仅「付费层」(T4 / CMP-10 paywall) 可去除署名 —— 免费层调用方无法剥离。
//
// 与红线③ 免责声明的关系: 免责声明由 core.renderResult 强制注入并恒为
// 文本末行 (不可被本模块或任何调用方覆盖)。署名水印焊接在免责行「之上」,
// 因此最终可复制文本的尾部永远是规范免责文案。
import { renderResult, RED_LINE_DISCLAIMER } from '../core'
import type { GenerationResult } from '../core'

/**
 * 计费层。免费层带署名水印;付费层 (T4) 去署名。
 * 单一事实来源在 core/entitlements;此处仅再导出,历史 import 路径不变。
 */
import type { Tier } from '../core'
export type { Tier }

/**
 * 免费层署名水印文案。轻量、单行、可被用户连同正文一起复制分发,
 * 从而把每一条被转发的文案变成回流入口。措辞克制,不夸大、不承诺。
 */
export const FREE_TIER_WATERMARK =
  '✦ 由「缤果文案台」AI 生成 · binguosoft65.github.io/binguo-app'

/**
 * 渲染为可一键复制/分发的纯文本。
 *
 * - `paid`: 复用 core.renderResult,尾部仍为强制免责 (红线③)。
 * - `free`: 在免责行「之上」焊入署名水印 —— 免费层调用方无法绕过,
 *   且不破坏「免责恒为末行」的红线③ 保证。
 *
 * 默认 `free`: paywall (T4) 未接入前,一切输出都带分发楔子。
 */
export function renderShareText(
  result: GenerationResult,
  tier: Tier = 'free',
): string {
  const base = renderResult(result)
  if (tier === 'paid') return base

  const tailIdx = base.lastIndexOf(RED_LINE_DISCLAIMER)
  if (tailIdx < 0) {
    // 理论不可达 (core 保证免责在末行);保守兜底:水印 + 免责都补齐。
    return `${base}\n\n${FREE_TIER_WATERMARK}\n\n${RED_LINE_DISCLAIMER}`
  }
  const head = base.slice(0, tailIdx)
  const tail = base.slice(tailIdx)
  return `${head}${FREE_TIER_WATERMARK}\n\n${tail}`
}

/** 免费层是否应展示署名水印。集中判定,便于 T4 接入时切换。 */
export function hasWatermark(tier: Tier): boolean {
  return tier === 'free'
}
