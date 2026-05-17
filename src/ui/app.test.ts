/**
 * @vitest-environment jsdom
 */
// 端到端闭环测试 (CMP-8 Done 判据):本地 mock provider 下「输入 → 结果」
// 跑通,且固定免责页脚恒在 (红线③)、整站 DOM 无洗稿入口 (红线①)。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountApp } from './app'
import { createGenerator, MockLlmProvider, RED_LINE_DISCLAIMER } from '../core'

const FORBIDDEN_INPUT_HINTS = [
  'article',
  'url',
  'link',
  'rewrite',
  'paraphrase',
  'original',
  'source',
  'reference',
  'scrape',
  'crawl',
  'paste',
  '洗稿',
  '改写',
  '搬运',
  '粘贴',
  '链接',
  '原文',
  '网址',
]

function makeRoot(): HTMLDivElement {
  const root = document.createElement('div')
  document.body.append(root)
  return root
}

beforeEach(() => {
  localStorage.clear()
  document.body.replaceChildren()
})

describe('CMP-8 闭环 + 红线 UI 留痕', () => {
  it('红线③: fixed disclaimer footer is present immediately, before any generation', () => {
    const root = makeRoot()
    mountApp(root, { generator: createGenerator(new MockLlmProvider()) })
    const footer = root.querySelector<HTMLElement>(
      '[data-testid="disclaimer-footer"]',
    )
    expect(footer).not.toBeNull()
    expect(footer?.textContent).toBe(RED_LINE_DISCLAIMER)
  })

  it('红线①: no rewrite/article/url/paste input anywhere in the mounted app', () => {
    const root = makeRoot()
    mountApp(root, { generator: createGenerator(new MockLlmProvider()) })
    const controls = root.querySelectorAll('input,textarea,select')
    for (const c of Array.from(controls)) {
      const sig = [
        c.getAttribute('name') ?? '',
        c.id,
        c.getAttribute('placeholder') ?? '',
      ]
        .join(' ')
        .toLowerCase()
      for (const hint of FORBIDDEN_INPUT_HINTS) {
        expect(sig.includes(hint), `forbidden entry "${hint}" in ${sig}`).toBe(
          false,
        )
      }
    }
  })

  it('runs the input → result loop with the mock provider and records history', async () => {
    const root = makeRoot()
    mountApp(root, {
      generator: createGenerator(new MockLlmProvider()),
      tier: 'free',
    })

    const form = root.querySelector<HTMLFormElement>(
      '[data-testid="input-form"]',
    )!
    ;(
      form.querySelector('[name="sellingPoints"]') as HTMLTextAreaElement
    ).value = '冷萃工艺,0 香精,3 秒回温'
    ;(form.querySelector('[name="topic"]') as HTMLTextAreaElement).value =
      '夏天办公室囤什么咖啡'

    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )

    await vi.waitFor(() => {
      const panel = root.querySelector('[data-testid="result-panel"]')
      expect(panel).not.toBeNull()
    })

    expect(
      root.querySelectorAll('[data-testid="titles"] li'),
    ).toHaveLength(5)
    const bodyText =
      root.querySelector<HTMLElement>('[data-testid="body"]')?.textContent ??
      ''
    for (const seg of ['钩子', '痛点', '价值', 'CTA']) {
      expect(bodyText).toContain(seg)
    }
    expect(
      root.querySelector('[data-testid="watermark"]'),
    ).not.toBeNull()
    expect(
      root.querySelector('[data-testid="result-disclaimer"]')?.textContent,
    ).toBe(RED_LINE_DISCLAIMER)

    // 历史记录闭环:生成后历史区出现一条记录。
    const items = root.querySelectorAll(
      '[data-testid="history-list"] .history-item',
    )
    expect(items).toHaveLength(1)
    expect(items[0].textContent).toContain('夏天办公室囤什么咖啡')
  })

  it('shows a red-line error (not a result) when a URL is smuggled into topic', async () => {
    const root = makeRoot()
    mountApp(root, { generator: createGenerator(new MockLlmProvider()) })
    const form = root.querySelector<HTMLFormElement>(
      '[data-testid="input-form"]',
    )!
    ;(
      form.querySelector('[name="sellingPoints"]') as HTMLTextAreaElement
    ).value = '真实卖点'
    ;(form.querySelector('[name="topic"]') as HTMLTextAreaElement).value =
      '把这篇 https://example.com/post 改写一下'
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )

    await vi.waitFor(() => {
      const err = root.querySelector<HTMLElement>(
        '[data-testid="error-box"]',
      )
      expect(err && !err.hidden).toBe(true)
    })
    expect(root.querySelector('[data-testid="result-panel"]')).toBeNull()
    expect(
      root.querySelector('[data-testid="error-box"]')?.textContent ?? '',
    ).toMatch(/红线/)
  })
})
