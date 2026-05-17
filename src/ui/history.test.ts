// 历史 / 收藏 本地存储测试 (注入假 localStorage,无需 jsdom)。
import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadHistory,
  addRecord,
  toggleFavorite,
  removeRecord,
  favorites,
} from './history'
import { RED_LINE_DISCLAIMER } from '../core'
import type { GenerationInput, GenerationResult } from '../core'

class FakeStorage implements Storage {
  private map = new Map<string, string>()
  get length(): number {
    return this.map.size
  }
  clear(): void {
    this.map.clear()
  }
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null
  }
  key(i: number): string | null {
    return Array.from(this.map.keys())[i] ?? null
  }
  removeItem(k: string): void {
    this.map.delete(k)
  }
  setItem(k: string, v: string): void {
    this.map.set(k, String(v))
  }
}

const input: GenerationInput = {
  sellingPoints: '冷萃 0 香精',
  topic: '夏天囤咖啡',
  platform: 'xiaohongshu',
  goal: 'seed',
  style: 'warm_sharing',
}
const result: GenerationResult = {
  titles: ['t1', 't2', 't3', 't4', 't5'],
  body: { hook: 'h', painPoint: 'p', value: 'v', cta: 'c' },
  tags: ['x'],
  disclaimer: RED_LINE_DISCLAIMER,
  meta: { platform: 'xiaohongshu', goal: 'seed', style: 'warm_sharing' },
}

let scope: { localStorage: Storage }
beforeEach(() => {
  scope = { localStorage: new FakeStorage() }
})

describe('历史 / 收藏 (localStorage)', () => {
  it('starts empty, then add → load round-trips newest-first', () => {
    expect(loadHistory(scope)).toEqual([])
    addRecord(input, result, scope)
    const list = addRecord({ ...input, topic: '第二条' }, result, scope)
    expect(list).toHaveLength(2)
    expect(list[0].input.topic).toBe('第二条')
    expect(loadHistory(scope)).toHaveLength(2)
  })

  it('toggleFavorite flips the flag and favorites() filters', () => {
    const list = addRecord(input, result, scope)
    const id = list[0].id
    expect(favorites(scope)).toHaveLength(0)
    toggleFavorite(id, scope)
    expect(favorites(scope)).toHaveLength(1)
    toggleFavorite(id, scope)
    expect(favorites(scope)).toHaveLength(0)
  })

  it('removeRecord deletes by id', () => {
    const list = addRecord(input, result, scope)
    expect(removeRecord(list[0].id, scope)).toEqual([])
  })

  it('corrupt storage degrades to empty, never throws', () => {
    scope.localStorage.setItem('binguo:history:v1', '{not json')
    expect(loadHistory(scope)).toEqual([])
    expect(() => addRecord(input, result, scope)).not.toThrow()
  })

  it('survives a totally missing storage (returns [], no throw)', () => {
    const noStore = {} as { localStorage?: Storage }
    expect(loadHistory(noStore)).toEqual([])
    expect(() => addRecord(input, result, noStore)).not.toThrow()
  })
})
