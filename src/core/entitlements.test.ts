// 计费层闸位契约测试 (CMP-10 / T4)。核心不变量:
//   - 免费层: 所有锁定能力恒为 locked, 正文被收敛为短正文
//   - 付费层 (占位, 真实支付=下游 CMP-6): 全部解锁, 正文不收敛
//   - 锁定能力注册表恰好覆盖四项闸位, 无孤儿
import { describe, it, expect } from 'vitest'
import {
  FREE_DAILY_LIMIT,
  FREE_BODY_PREVIEW_CHARS,
  LOCKED_CAPABILITY_IDS,
  LOCKED_CAPABILITIES,
  isCapabilityLocked,
  unlockedCapabilities,
  clampBodyForTier,
} from './entitlements'
import type { GenerationBody } from './generate'

describe('CMP-10 计费层闸位契约', () => {
  it('免费层每日额度为 3 次', () => {
    expect(FREE_DAILY_LIMIT).toBe(3)
  })

  it('锁定能力注册表恰好覆盖四项闸位且无孤儿', () => {
    expect([...LOCKED_CAPABILITY_IDS].sort()).toEqual(
      [
        'long_body',
        'template_library',
        'unlimited',
        'watermark_free_export',
      ].sort(),
    )
    for (const id of LOCKED_CAPABILITY_IDS) {
      const cap = LOCKED_CAPABILITIES[id]
      expect(cap.id).toBe(id)
      expect(cap.label.length).toBeGreaterThan(0)
      expect(cap.desc.length).toBeGreaterThan(0)
    }
    expect(Object.keys(LOCKED_CAPABILITIES).sort()).toEqual(
      [...LOCKED_CAPABILITY_IDS].sort(),
    )
  })

  it('免费层: 每一项锁定能力都被 gate', () => {
    for (const id of LOCKED_CAPABILITY_IDS) {
      expect(isCapabilityLocked(id, 'free')).toBe(true)
    }
    expect(unlockedCapabilities('free')).toEqual([])
  })

  it('付费层 (占位): 全部解锁', () => {
    for (const id of LOCKED_CAPABILITY_IDS) {
      expect(isCapabilityLocked(id, 'paid')).toBe(false)
    }
    expect([...unlockedCapabilities('paid')].sort()).toEqual(
      [...LOCKED_CAPABILITY_IDS].sort(),
    )
  })

  it('免费层把超长正文收敛为短正文 (长正文是锁定能力)', () => {
    const long = 'x'.repeat(FREE_BODY_PREVIEW_CHARS + 50)
    const body: GenerationBody = {
      hook: long,
      painPoint: long,
      value: long,
      cta: long,
    }
    const free = clampBodyForTier(body, 'free')
    for (const seg of ['hook', 'painPoint', 'value', 'cta'] as const) {
      expect(free[seg].length).toBeLessThan(long.length)
      expect(free[seg].endsWith('…')).toBe(true)
      expect(free[seg].length).toBeLessThanOrEqual(FREE_BODY_PREVIEW_CHARS + 1)
    }
  })

  it('短于阈值的正文不被截断, 也不加省略号', () => {
    const short = '短句'
    const body: GenerationBody = {
      hook: short,
      painPoint: short,
      value: short,
      cta: short,
    }
    const free = clampBodyForTier(body, 'free')
    expect(free.hook).toBe(short)
    expect(free.hook.endsWith('…')).toBe(false)
  })

  it('付费层不收敛正文 (完整长正文)', () => {
    const long = 'y'.repeat(FREE_BODY_PREVIEW_CHARS + 50)
    const body: GenerationBody = {
      hook: long,
      painPoint: long,
      value: long,
      cta: long,
    }
    const paid = clampBodyForTier(body, 'paid')
    expect(paid).toEqual(body)
  })
})
