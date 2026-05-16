// prompt 构造器 + 平台/目标/风格 模板注册表 单测。
// 同时锁定红线①在 prompt 层的纵深防御:系统提示词必须硬禁改写/洗稿。
import { describe, it, expect } from 'vitest'
import { GOALS, PLATFORMS, STYLE_IDS } from './schema'
import { RedLineError } from './redline'
import {
  GOAL_REGISTRY,
  PLATFORM_REGISTRY,
  STYLE_REGISTRY,
  buildPrompt,
} from './templates'

const input = {
  sellingPoints: '冷萃工艺,0 香精,3 秒回温',
  topic: '夏天办公室囤什么咖啡',
  platform: 'xiaohongshu',
  goal: 'seed',
  style: 'warm_sharing',
} as const

describe('模板注册表 (platform / goal / style registries)', () => {
  it('platform registry covers exactly the schema enum, no orphans', () => {
    expect(Object.keys(PLATFORM_REGISTRY).sort()).toEqual([...PLATFORMS].sort())
  })
  it('goal registry covers exactly the schema enum', () => {
    expect(Object.keys(GOAL_REGISTRY).sort()).toEqual([...GOALS].sort())
  })
  it('style registry covers exactly the schema enum', () => {
    expect(Object.keys(STYLE_REGISTRY).sort()).toEqual([...STYLE_IDS].sort())
  })
  it('every profile has a non-empty label and guidance', () => {
    for (const reg of [PLATFORM_REGISTRY, GOAL_REGISTRY, STYLE_REGISTRY]) {
      for (const p of Object.values(reg)) {
        expect(p.label.trim().length).toBeGreaterThan(0)
        expect(p.guidance.trim().length).toBeGreaterThan(0)
      }
    }
  })
})

describe('buildPrompt — 结构化 钩子-痛点-价值-CTA 构造器', () => {
  it('returns non-empty system + user strings', () => {
    const { system, user } = buildPrompt(input)
    expect(system.trim().length).toBeGreaterThan(0)
    expect(user.trim().length).toBeGreaterThan(0)
  })

  it('系统提示词硬禁改写/洗稿/搬运,强制原创 (红线① 纵深防御)', () => {
    const { system } = buildPrompt(input)
    expect(system).toContain('洗稿')
    expect(system).toContain('改写')
    expect(system).toContain('原创')
  })

  it('系统提示词约束输出为严格 JSON 且含 钩子-痛点-价值-CTA 结构', () => {
    const { system } = buildPrompt(input)
    expect(system).toContain('JSON')
    expect(system).toContain('hook')
    expect(system).toContain('painPoint')
    expect(system).toContain('value')
    expect(system).toContain('cta')
  })

  it('系统提示词禁止夸大功效/绝对化承诺 (红线③ 纵深防御)', () => {
    const { system } = buildPrompt(input)
    expect(system).toContain('夸大')
  })

  it('user prompt is built only from user-filled input (contains sellingPoints + topic verbatim)', () => {
    const { user } = buildPrompt(input)
    expect(user).toContain(input.sellingPoints)
    expect(user).toContain(input.topic)
  })

  it('user prompt embeds the selected platform / goal / style guidance', () => {
    const { user } = buildPrompt(input)
    expect(user).toContain(PLATFORM_REGISTRY.xiaohongshu.guidance)
    expect(user).toContain(GOAL_REGISTRY.seed.guidance)
    expect(user).toContain(STYLE_REGISTRY.warm_sharing.guidance)
  })

  it('prompt carries no external-retrieval instruction (no URLs leaked in)', () => {
    const { system, user } = buildPrompt(input)
    expect(user).not.toMatch(/https?:\/\//)
    expect(system).not.toMatch(/https?:\/\//)
  })

  it('throws RedLineError(invalid_value) for an unknown style id', () => {
    try {
      buildPrompt({ ...input, style: 'no_such_style' as never })
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(RedLineError)
      expect((e as RedLineError).code).toBe('invalid_value')
    }
  })
})
