// 免费层每日计次 —— 纯本地 (localStorage) 每日额度计数器 (CMP-10 / T4).
//
// 复利资产 (显式标注): 与具体产品无耦合的「每日限次」原语, Q3 第二
// 数字产品可直接复用 —— 换 limit/存储 key 即可, 计次与跨日重置逻辑不动。
//
// 隐私: 只在本机浏览器记「当天用了几次」, 不含任何用户输入/结果,
// 不回传 (与 history.ts / 红线①② 一致)。
//
// 降级策略 (安全要害): 存储损坏/不可用时**不**放行无限次, 而是降级为
// 「会话内内存计次」—— 闸仍然生效, 用户无法靠禁用存储绕过免费额度。
import { FREE_DAILY_LIMIT } from './entitlements'

const STORAGE_KEY = 'binguo:quota:v1'

export interface QuotaScope {
  /** 注入存储 (测试假实现 / 不可用时为 undefined)。默认 globalThis。 */
  localStorage?: Storage
  /** 注入时钟 (测试可控当天)。默认 Date.now。 */
  now?: () => number
}

export interface QuotaState {
  /** 本地自然日 key (YYYY-MM-DD)。 */
  date: string
  /** 当天已用次数。 */
  used: number
  /** 当天额度上限。 */
  limit: number
  /** 当天剩余 (下限 0)。 */
  remaining: number
  /** 是否已耗尽 (used >= limit) —— 供 paywall 闸触发。 */
  exhausted: boolean
}

interface StoredQuota {
  date: string
  used: number
}

/** 存储不可用时的会话内兜底 (按当日 key 计次, 闸不被绕过)。 */
let memoryFallback: StoredQuota | null = null

function resolveScope(scope?: QuotaScope): {
  storage: Storage | null
  now: () => number
} {
  const now = scope?.now ?? (() => Date.now())
  let storage: Storage | null
  if (scope && 'localStorage' in scope) {
    storage = scope.localStorage ?? null
  } else {
    try {
      storage = (globalThis as { localStorage?: Storage }).localStorage ?? null
    } catch {
      storage = null
    }
  }
  return { storage, now }
}

/** 本地自然日 key，跨日即重置。 */
function dayKey(now: () => number): string {
  const d = new Date(now())
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

function readStored(storage: Storage | null): StoredQuota | null {
  if (!storage) return memoryFallback
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as StoredQuota).date === 'string' &&
      typeof (parsed as StoredQuota).used === 'number'
    ) {
      return parsed as StoredQuota
    }
    return null
  } catch {
    return null
  }
}

function writeStored(storage: Storage | null, value: StoredQuota): void {
  if (!storage) {
    memoryFallback = value
    return
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // 配额超限/隐私模式: 退到内存计次, 闸仍生效。
    memoryFallback = value
  }
}

function toState(stored: StoredQuota): QuotaState {
  const used = Math.max(0, stored.used)
  const remaining = Math.max(0, FREE_DAILY_LIMIT - used)
  return {
    date: stored.date,
    used,
    limit: FREE_DAILY_LIMIT,
    remaining,
    exhausted: used >= FREE_DAILY_LIMIT,
  }
}

/** 当天计次状态 (按当天对齐), 不消耗额度。 */
export function peekQuota(scope?: QuotaScope): QuotaState {
  const { storage, now } = resolveScope(scope)
  const today = dayKey(now)
  const stored = readStored(storage)
  if (!stored || stored.date !== today) {
    return toState({ date: today, used: 0 })
  }
  return toState(stored)
}

/** 消耗一次额度, 返回更新后的状态。耗尽后再调用不会让 remaining 变负。 */
export function consumeQuota(scope?: QuotaScope): QuotaState {
  const { storage, now } = resolveScope(scope)
  const today = dayKey(now)
  const stored = readStored(storage)
  const base =
    !stored || stored.date !== today
      ? { date: today, used: 0 }
      : { date: today, used: Math.max(0, stored.used) }
  const next: StoredQuota = { date: today, used: base.used + 1 }
  writeStored(storage, next)
  return toState(next)
}

/** 清空当日计次 (测试 / 客服兜底)。同时清掉内存兜底。 */
export function resetQuota(scope?: QuotaScope): void {
  const { storage } = resolveScope(scope)
  memoryFallback = null
  if (!storage) return
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    /* 忽略: 内存兜底已清 */
  }
}
