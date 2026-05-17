/**
 * @vitest-environment jsdom
 */
// Paywall 闸位占位组件测试 (CMP-10 / T4)。核心不变量:
//   - 闸位触发即展示占位 (额度耗尽 / 锁定能力 两种入口)
//   - 列出全部锁定能力作为解锁卖点
//   - **本轨不做收银**: 组件内无任何支付表单/输入 (真实支付=下游 CMP-6)
//   - 关闭 / 升级意向 回调可被宿主接管
import { describe, it, expect, vi } from 'vitest'
import { renderPaywall } from './paywall'
import { LOCKED_CAPABILITY_IDS, LOCKED_CAPABILITIES } from '../core'

describe('CMP-10 paywall 闸位占位', () => {
  it('额度耗尽入口: 渲染占位, 文案点明无限次', () => {
    const node = renderPaywall({ reason: 'quota_exhausted' })
    expect(node.dataset.testid).toBe('paywall')
    const text = node.textContent ?? ''
    expect(text).toContain('额度')
    expect(text).toContain(LOCKED_CAPABILITIES.unlimited.label)
  })

  it('锁定能力入口: 文案点明该能力', () => {
    const node = renderPaywall({
      reason: 'locked_capability',
      capability: 'long_body',
    })
    expect(node.textContent ?? '').toContain(
      LOCKED_CAPABILITIES.long_body.label,
    )
  })

  it('列出全部锁定能力作为解锁卖点', () => {
    const node = renderPaywall({ reason: 'quota_exhausted' })
    const benefits = node.querySelectorAll(
      '[data-testid="paywall-benefits"] li',
    )
    expect(benefits).toHaveLength(LOCKED_CAPABILITY_IDS.length)
    const joined = Array.from(benefits)
      .map((b) => b.textContent ?? '')
      .join(' ')
    for (const id of LOCKED_CAPABILITY_IDS) {
      expect(joined).toContain(LOCKED_CAPABILITIES[id].label)
    }
  })

  it('本轨不做收银: 组件内无支付表单/输入', () => {
    const node = renderPaywall({ reason: 'quota_exhausted' })
    expect(node.querySelectorAll('form')).toHaveLength(0)
    expect(node.querySelectorAll('input')).toHaveLength(0)
    expect(node.querySelectorAll('a[href]')).toHaveLength(0)
  })

  it('升级 CTA 是占位: 点击不收款, 只显示「即将开放」提示并回调意向', () => {
    const onUpgradeIntent = vi.fn()
    const node = renderPaywall({
      reason: 'quota_exhausted',
      onUpgradeIntent,
    })
    const note = node.querySelector<HTMLElement>(
      '[data-testid="paywall-placeholder-note"]',
    )
    expect(note).not.toBeNull()
    expect(note!.hidden).toBe(true)
    const btn = node.querySelector<HTMLButtonElement>(
      '[data-testid="paywall-upgrade-btn"]',
    )!
    btn.click()
    expect(onUpgradeIntent).toHaveBeenCalledTimes(1)
    expect(note!.hidden).toBe(false)
    expect(note!.textContent ?? '').toContain('即将')
  })

  it('关闭按钮触发 onClose', () => {
    const onClose = vi.fn()
    const node = renderPaywall({ reason: 'quota_exhausted', onClose })
    node
      .querySelector<HTMLButtonElement>('[data-testid="paywall-close-btn"]')!
      .click()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
