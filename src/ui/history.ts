// 历史记录 + 收藏 —— 纯本地存储 (localStorage),不上传任何用户输入。
//
// 隐私: 用户填写的卖点/选题与生成结果只留在本机浏览器,产品不回传、
// 不抓取 (与红线①②一致)。存储被损坏/超额时静默降级为「无历史」,
// 绝不抛出阻断生成主流程。
import type { GenerationInput, GenerationResult } from '../core'

export interface HistoryRecord {
  id: string
  /** Unix 毫秒时间戳。 */
  createdAt: number
  input: GenerationInput
  result: GenerationResult
  favorite: boolean
}

const STORAGE_KEY = 'binguo:history:v1'
const MAX_RECORDS = 50

/** 仅依赖 localStorage 的最小宿主接口 —— 测试可注入假实现。 */
export interface Store {
  localStorage?: Storage
}

function getStorage(scope?: Store): Storage | null {
  try {
    const host = scope ?? (globalThis as unknown as Store)
    return host.localStorage ?? null
  } catch {
    return null
  }
}

function genId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function isRecord(v: unknown): v is HistoryRecord {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.createdAt === 'number' &&
    typeof r.favorite === 'boolean' &&
    typeof r.input === 'object' &&
    r.input !== null &&
    typeof r.result === 'object' &&
    r.result !== null
  )
}

/** 读取全部历史 (新→旧)。存储不可用/损坏时返回空数组,不抛错。 */
export function loadHistory(scope?: Store): HistoryRecord[] {
  const ls = getStorage(scope)
  if (!ls) return []
  try {
    const raw = ls.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isRecord)
  } catch {
    return []
  }
}

function persist(records: HistoryRecord[], scope?: Store): void {
  const ls = getStorage(scope)
  if (!ls) return
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)))
  } catch {
    // 配额超限/隐私模式: 静默丢弃,主流程不受影响。
  }
}

/** 追加一条新生成记录,返回更新后的列表 (新→旧)。 */
export function addRecord(
  input: GenerationInput,
  result: GenerationResult,
  scope?: Store,
): HistoryRecord[] {
  const record: HistoryRecord = {
    id: genId(),
    createdAt: Date.now(),
    input,
    result,
    favorite: false,
  }
  const next = [record, ...loadHistory(scope)].slice(0, MAX_RECORDS)
  persist(next, scope)
  return next
}

/** 切换收藏标记,返回更新后的列表。 */
export function toggleFavorite(id: string, scope?: Store): HistoryRecord[] {
  const next = loadHistory(scope).map((r) =>
    r.id === id ? { ...r, favorite: !r.favorite } : r,
  )
  persist(next, scope)
  return next
}

/** 删除一条记录,返回更新后的列表。 */
export function removeRecord(id: string, scope?: Store): HistoryRecord[] {
  const next = loadHistory(scope).filter((r) => r.id !== id)
  persist(next, scope)
  return next
}

/** 仅收藏项。 */
export function favorites(scope?: Store): HistoryRecord[] {
  return loadHistory(scope).filter((r) => r.favorite)
}
