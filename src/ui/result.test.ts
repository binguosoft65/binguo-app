/**
 * @vitest-environment jsdom
 */
// 结果区 UI 测试 —— 红线③ 留痕:免责文案在结果区恒存在;免费层署名
// 水印渲染且复制文本必带水印 + 免责。
import { describe, it, expect, vi } from 'vitest'
import { renderResultPanel } from './result'
import { FREE_TIER_WATERMARK } from './watermark'
import { RED_LINE_DISCLAIMER } from '../core'
import type { GenerationResult } from '../core'

const result: GenerationResult = {
  titles: ['标题1', '标题2', '标题3', '标题4', '标题5'],
  body: {
    hook: '钩子文案',
    painPoint: '痛点文案',
    value: '价值文案',
    cta: 'CTA 文案',
  },
  tags: ['标签A', '标签B', '标签C'],
  disclaimer: RED_LINE_DISCLAIMER,
  meta: { platform: 'douyin_oral', goal: 'convert', style: 'punchy_hook' },
}

describe('结果区结构', () => {
  it('renders 5 titles, the 4-part body, and tags', () => {
    const el = renderResultPanel(result)
    expect(el.querySelectorAll('[data-testid="titles"] li')).toHaveLength(5)
    const bodyText =
      el.querySelector<HTMLElement>('[data-testid="body"]')?.textContent ?? ''
    for (const seg of ['钩子', '痛点', '价值', 'CTA']) {
      expect(bodyText).toContain(seg)
    }
    expect(
      el.querySelectorAll('[data-testid="tags"] .tag'),
    ).toHaveLength(3)
  })

  it('红线③: always shows the canonical disclaimer in the result', () => {
    const el = renderResultPanel(result)
    const disc = el.querySelector<HTMLElement>(
      '[data-testid="result-disclaimer"]',
    )
    expect(disc?.textContent).toBe(RED_LINE_DISCLAIMER)
  })
})

describe('免费层 vs 付费层水印', () => {
  it('free tier renders the signature watermark element', () => {
    const el = renderResultPanel(result, { tier: 'free' })
    expect(
      el.querySelector<HTMLElement>('[data-testid="watermark"]')?.textContent,
    ).toBe(FREE_TIER_WATERMARK)
  })

  it('paid tier hides the watermark but still shows the disclaimer', () => {
    const el = renderResultPanel(result, { tier: 'paid' })
    expect(el.querySelector('[data-testid="watermark"]')).toBeNull()
    expect(
      el.querySelector('[data-testid="result-disclaimer"]')?.textContent,
    ).toBe(RED_LINE_DISCLAIMER)
  })

  it('one-click copy yields text containing watermark + disclaimer (free)', () => {
    const onCopy = vi.fn()
    const el = renderResultPanel(result, { tier: 'free', onCopy })
    el.querySelector<HTMLButtonElement>(
      '[data-testid="copy-btn"]',
    )!.click()
    return vi.waitFor(() => {
      expect(onCopy).toHaveBeenCalledTimes(1)
      const [text] = onCopy.mock.calls[0] as [string, boolean]
      expect(text).toContain(FREE_TIER_WATERMARK)
      expect(text.trimEnd().endsWith(RED_LINE_DISCLAIMER)).toBe(true)
    })
  })

  it('renders a favorite toggle when onToggleFavorite is provided', () => {
    const onToggleFavorite = vi.fn()
    const el = renderResultPanel(result, { onToggleFavorite })
    const btn = el.querySelector<HTMLButtonElement>(
      '[data-testid="favorite-btn"]',
    )
    expect(btn).not.toBeNull()
    btn!.click()
    expect(onToggleFavorite).toHaveBeenCalledTimes(1)
  })
})
