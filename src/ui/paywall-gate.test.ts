/**
 * @vitest-environment jsdom
 */
// CMP-10 / T4 Done 判据端到端留痕:
//   1) 免费 3 次/天计次 + 额度耗尽正确触发 paywall 闸
//   2) 锁定能力 (长正文 / 去水印导出 / 风格行业模板库) 被正确 gate
//   3) 本轨不收银: 闸触发只展示占位, 不出现支付表单
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountApp } from './app'
import { createGenerator, MockLlmProvider, LOCKED_CAPABILITIES } from '../core'

function makeRoot(): HTMLDivElement {
  const root = document.createElement('div')
  document.body.append(root)
  return root
}

async function generateOnce(root: HTMLElement, n: number): Promise<void> {
  const form = root.querySelector<HTMLFormElement>(
    '[data-testid="input-form"]',
  )!
  ;(form.querySelector('[name="sellingPoints"]') as HTMLTextAreaElement).value =
    '冷萃工艺,0 香精,3 秒回温'
  ;(form.querySelector('[name="topic"]') as HTMLTextAreaElement).value =
    `选题第 ${n} 次`
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await vi.waitFor(() => {
    const items = root.querySelectorAll(
      '[data-testid="history-list"] .history-item',
    )
    expect(items.length).toBe(n)
  })
}

beforeEach(() => {
  localStorage.clear()
  document.body.replaceChildren()
})

describe('CMP-10 计次 + paywall 闸 UX', () => {
  it('免费版额度徽标初始为 今日剩余 3/3', () => {
    const root = makeRoot()
    mountApp(root, {
      generator: createGenerator(new MockLlmProvider()),
      tier: 'free',
    })
    const badge = root.querySelector<HTMLElement>(
      '[data-testid="quota-badge"]',
    )
    expect(badge).not.toBeNull()
    expect(badge!.textContent ?? '').toContain('3')
    expect(root.querySelector('[data-testid="paywall"]')).toBeNull()
  })

  it('每次生成消耗 1 次, 徽标递减', async () => {
    const root = makeRoot()
    mountApp(root, {
      generator: createGenerator(new MockLlmProvider()),
      tier: 'free',
    })
    await generateOnce(root, 1)
    expect(
      root.querySelector('[data-testid="quota-badge"]')?.textContent ?? '',
    ).toContain('2')
    await generateOnce(root, 2)
    expect(
      root.querySelector('[data-testid="quota-badge"]')?.textContent ?? '',
    ).toContain('1')
  })

  it('Done: 免费额度耗尽 (3 次) 后第 4 次提交触发 paywall 闸, 不再产出结果', async () => {
    const root = makeRoot()
    mountApp(root, {
      generator: createGenerator(new MockLlmProvider()),
      tier: 'free',
    })
    await generateOnce(root, 1)
    await generateOnce(root, 2)
    await generateOnce(root, 3)
    expect(root.querySelector('[data-testid="paywall"]')).toBeNull()

    // 第 4 次: 提交应被闸住 —— 不新增历史, 弹出 paywall (无限次卖点)
    const form = root.querySelector<HTMLFormElement>(
      '[data-testid="input-form"]',
    )!
    ;(
      form.querySelector('[name="sellingPoints"]') as HTMLTextAreaElement
    ).value = '真实卖点'
    ;(form.querySelector('[name="topic"]') as HTMLTextAreaElement).value =
      '第 4 次选题'
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )

    await vi.waitFor(() => {
      expect(root.querySelector('[data-testid="paywall"]')).not.toBeNull()
    })
    expect(
      root.querySelectorAll('[data-testid="history-list"] .history-item'),
    ).toHaveLength(3)
    expect(
      root.querySelector('[data-testid="paywall"]')?.textContent ?? '',
    ).toContain(LOCKED_CAPABILITIES.unlimited.label)
    // 本轨不收银
    expect(
      root.querySelectorAll('[data-testid="paywall"] form, [data-testid="paywall"] input'),
    ).toHaveLength(0)
  })

  it('锁定能力被 gate: 长正文 / 去水印导出 在免费层结果区只给闸位入口', async () => {
    const root = makeRoot()
    mountApp(root, {
      generator: createGenerator(new MockLlmProvider()),
      tier: 'free',
    })
    await generateOnce(root, 1)

    const longBtn = root.querySelector<HTMLButtonElement>(
      '[data-testid="unlock-long-body-btn"]',
    )
    const wmBtn = root.querySelector<HTMLButtonElement>(
      '[data-testid="unlock-watermark-free-btn"]',
    )
    expect(longBtn).not.toBeNull()
    expect(wmBtn).not.toBeNull()

    longBtn!.click()
    const pw = root.querySelector<HTMLElement>('[data-testid="paywall"]')
    expect(pw).not.toBeNull()
    expect(pw!.textContent ?? '').toContain(
      LOCKED_CAPABILITIES.long_body.label,
    )

    // 关闭后可再触发去水印导出闸
    root
      .querySelector<HTMLButtonElement>('[data-testid="paywall-close-btn"]')!
      .click()
    expect(root.querySelector('[data-testid="paywall"]')).toBeNull()
    wmBtn!.click()
    expect(
      root.querySelector('[data-testid="paywall"]')?.textContent ?? '',
    ).toContain(LOCKED_CAPABILITIES.watermark_free_export.label)
  })

  it('锁定能力被 gate: 风格/行业模板库 在表单处给闸位入口', () => {
    const root = makeRoot()
    mountApp(root, {
      generator: createGenerator(new MockLlmProvider()),
      tier: 'free',
    })
    const tplBtn = root.querySelector<HTMLButtonElement>(
      '[data-testid="locked-templates-btn"]',
    )
    expect(tplBtn).not.toBeNull()
    tplBtn!.click()
    expect(
      root.querySelector('[data-testid="paywall"]')?.textContent ?? '',
    ).toContain(LOCKED_CAPABILITIES.template_library.label)
  })
})
