// 免费层每日计次测试 (CMP-10 / T4)。核心不变量 (Done 判据):
//   - 默认每日额度 = FREE_DAILY_LIMIT (3)
//   - 用满 3 次后 exhausted=true (供 paywall 闸触发)
//   - 跨自然日自动重置
//   - 存储损坏/不可用时降级为「会话内内存计次」, 闸仍然有效 (不绕过)
import { describe, it, expect, beforeEach } from 'vitest'
import { peekQuota, consumeQuota, resetQuota } from './quota'
import { FREE_DAILY_LIMIT } from './entitlements'

/** 内存假 Storage —— 隔离每个用例。 */
function fakeStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => Array.from(m.keys())[i] ?? null,
    get length() {
      return m.size
    },
  } as Storage
}

const DAY1 = new Date('2026-05-17T10:00:00').getTime()
const DAY2 = new Date('2026-05-18T01:00:00').getTime()

describe('CMP-10 免费层每日计次', () => {
  let ls: Storage
  beforeEach(() => {
    ls = fakeStorage()
  })

  it('初始: 0 已用, 满额度可用, 未耗尽', () => {
    const q = peekQuota({ localStorage: ls, now: () => DAY1 })
    expect(q.used).toBe(0)
    expect(q.limit).toBe(FREE_DAILY_LIMIT)
    expect(q.remaining).toBe(FREE_DAILY_LIMIT)
    expect(q.exhausted).toBe(false)
  })

  it('peek 不消耗额度', () => {
    const scope = { localStorage: ls, now: () => DAY1 }
    peekQuota(scope)
    peekQuota(scope)
    expect(peekQuota(scope).used).toBe(0)
  })

  it('消耗 3 次后耗尽, 触发闸 (exhausted=true, remaining=0)', () => {
    const scope = { localStorage: ls, now: () => DAY1 }
    expect(consumeQuota(scope).remaining).toBe(2)
    expect(consumeQuota(scope).remaining).toBe(1)
    const third = consumeQuota(scope)
    expect(third.used).toBe(3)
    expect(third.remaining).toBe(0)
    expect(third.exhausted).toBe(true)
  })

  it('耗尽后继续 consume 不会让 remaining 变负, 仍为耗尽态', () => {
    const scope = { localStorage: ls, now: () => DAY1 }
    consumeQuota(scope)
    consumeQuota(scope)
    consumeQuota(scope)
    const over = consumeQuota(scope)
    expect(over.exhausted).toBe(true)
    expect(over.remaining).toBe(0)
  })

  it('跨自然日自动重置', () => {
    consumeQuota({ localStorage: ls, now: () => DAY1 })
    consumeQuota({ localStorage: ls, now: () => DAY1 })
    consumeQuota({ localStorage: ls, now: () => DAY1 })
    expect(peekQuota({ localStorage: ls, now: () => DAY1 }).exhausted).toBe(
      true,
    )
    const next = peekQuota({ localStorage: ls, now: () => DAY2 })
    expect(next.used).toBe(0)
    expect(next.exhausted).toBe(false)
  })

  it('存储损坏视为全新一天 (不抛错, 不绕过闸)', () => {
    ls.setItem('binguo:quota:v1', '{ this is not json')
    const q = peekQuota({ localStorage: ls, now: () => DAY1 })
    expect(q.used).toBe(0)
    expect(q.exhausted).toBe(false)
  })

  it('存储不可用时降级为内存计次 —— 闸仍生效, 不被绕过', () => {
    resetQuota({ now: () => DAY1 }) // 清掉可能的跨用例内存
    const scope = { localStorage: undefined, now: () => DAY1 }
    consumeQuota(scope)
    consumeQuota(scope)
    const third = consumeQuota(scope)
    expect(third.exhausted).toBe(true)
    expect(peekQuota(scope).exhausted).toBe(true)
    resetQuota(scope)
    expect(peekQuota(scope).exhausted).toBe(false)
  })

  it('resetQuota 清空当日计次 (测试/客服兜底用)', () => {
    const scope = { localStorage: ls, now: () => DAY1 }
    consumeQuota(scope)
    consumeQuota(scope)
    resetQuota(scope)
    expect(peekQuota(scope).used).toBe(0)
  })
})
