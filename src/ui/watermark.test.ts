// 免费层署名水印 (分发楔子) 测试。核心不变量:
//   - 免费层可复制文本必含署名水印 (不可砍)
//   - 无论计费层,免责文案 (红线③) 恒为文本末行 (水印不得篡夺末行)
//   - 付费层 (T4) 去署名,但免责仍在
import { describe, it, expect } from 'vitest'
import { renderShareText, hasWatermark, FREE_TIER_WATERMARK } from './watermark'
import { RED_LINE_DISCLAIMER } from '../core'
import type { GenerationResult } from '../core'

const result: GenerationResult = {
  titles: ['t1', 't2', 't3', 't4', 't5'],
  body: { hook: 'h', painPoint: 'p', value: 'v', cta: 'c' },
  tags: ['a', 'b'],
  disclaimer: RED_LINE_DISCLAIMER,
  meta: { platform: 'xiaohongshu', goal: 'seed', style: 'warm_sharing' },
}

describe('免费层署名水印', () => {
  it('free tier copy text carries the signature watermark', () => {
    const text = renderShareText(result, 'free')
    expect(text).toContain(FREE_TIER_WATERMARK)
  })

  it('free tier still ends with the red-line disclaimer (watermark above it)', () => {
    const text = renderShareText(result, 'free').trimEnd()
    expect(text.endsWith(RED_LINE_DISCLAIMER)).toBe(true)
    expect(text.indexOf(FREE_TIER_WATERMARK)).toBeLessThan(
      text.lastIndexOf(RED_LINE_DISCLAIMER),
    )
  })

  it('paid tier removes the watermark but keeps the disclaimer tail', () => {
    const text = renderShareText(result, 'paid').trimEnd()
    expect(text).not.toContain(FREE_TIER_WATERMARK)
    expect(text.endsWith(RED_LINE_DISCLAIMER)).toBe(true)
  })

  it('defaults to free tier (watermark on) when tier omitted', () => {
    expect(renderShareText(result)).toContain(FREE_TIER_WATERMARK)
    expect(hasWatermark('free')).toBe(true)
    expect(hasWatermark('paid')).toBe(false)
  })
})
