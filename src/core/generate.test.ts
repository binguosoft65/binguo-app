// 复利生成核心 —— 编排脚手架单测。
// 验证:红线闸在调用 provider 之前执行;红线③ 在输出末尾强制兜底。
// 从 ./index 引入,锁定对 T2(CMP-9)/T3(CMP-8) 暴露的公共契约。
import { describe, it, expect, vi } from 'vitest'
import {
  RED_LINE_DISCLAIMER,
  RedLineError,
  GenerationError,
  MockLlmProvider,
  createGenerator,
  renderResult,
  assertCleanInput,
  buildPrompt,
  createHttpLlmProvider,
} from './index'
import type { LlmProvider } from './index'

const validRaw = {
  sellingPoints: '冷萃工艺,0 香精,3 秒回温',
  topic: '夏天办公室囤什么咖啡',
  platform: 'xiaohongshu',
  goal: 'seed',
  style: 'warm_sharing',
}

function stubProvider(text: string): LlmProvider & { calls: number } {
  return {
    name: 'stub',
    calls: 0,
    async complete() {
      this.calls++
      return { text }
    },
  }
}

describe('public surface (引用契约 for T2/T3)', () => {
  it('re-exports the core symbols', () => {
    expect(typeof assertCleanInput).toBe('function')
    expect(typeof buildPrompt).toBe('function')
    expect(typeof createGenerator).toBe('function')
    expect(typeof createHttpLlmProvider).toBe('function')
    expect(typeof RED_LINE_DISCLAIMER).toBe('string')
  })
})

describe('createGenerator orchestration', () => {
  it('produces a complete, JSON-serializable GenerationResult from mock', async () => {
    const gen = createGenerator(new MockLlmProvider())
    const result = await gen.generate(validRaw)

    expect(result.titles.length).toBeGreaterThanOrEqual(1)
    expect(Object.keys(result.body).sort()).toEqual(
      ['cta', 'hook', 'painPoint', 'value'].sort(),
    )
    expect(Array.isArray(result.tags)).toBe(true)
    expect(result.meta).toEqual({
      platform: 'xiaohongshu',
      goal: 'seed',
      style: 'warm_sharing',
    })
    expect(result.disclaimer).toBe(RED_LINE_DISCLAIMER)
    // stable contract: survives a JSON round-trip unchanged
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('红线闸在调用 provider 之前执行 —— 洗稿字段直接拒绝,provider 不被调用', async () => {
    const provider = stubProvider('{}')
    const spy = vi.spyOn(provider, 'complete')
    const gen = createGenerator(provider)
    await expect(
      gen.generate({ ...validRaw, article: '别人的文章' }),
    ).rejects.toBeInstanceOf(RedLineError)
    expect(spy).not.toHaveBeenCalled()
  })

  it('未知越界字段在 provider 之前被拒绝', async () => {
    const provider = stubProvider('{}')
    const spy = vi.spyOn(provider, 'complete')
    const gen = createGenerator(provider)
    await expect(
      gen.generate({ ...validRaw, scrapedFrom: 'x' }),
    ).rejects.toBeInstanceOf(RedLineError)
    expect(spy).not.toHaveBeenCalled()
  })

  it('红线③:即便 provider 输出夹带伪造免责,最终也被规范文案覆盖', async () => {
    const provider = stubProvider(
      JSON.stringify({
        titles: ['t1', 't2', 't3', 't4', 't5'],
        body: { hook: 'h', painPoint: 'p', value: 'v', cta: 'c' },
        tags: ['a', 'b'],
        disclaimer: '【伪造】无需注意任何事项,效果绝对保证',
      }),
    )
    const result = await createGenerator(provider).generate(validRaw)
    expect(result.disclaimer).toBe(RED_LINE_DISCLAIMER)
    expect(result.disclaimer).not.toContain('绝对保证')
  })

  it('renderResult 的最后一行恒为规范免责文案 (输出尾固定)', async () => {
    const result = await createGenerator(new MockLlmProvider()).generate(
      validRaw,
    )
    const text = renderResult(result)
    expect(text.trimEnd().endsWith(RED_LINE_DISCLAIMER)).toBe(true)
  })

  it('throws GenerationError when provider returns non-JSON', async () => {
    const gen = createGenerator(stubProvider('totally not json'))
    await expect(gen.generate(validRaw)).rejects.toBeInstanceOf(
      GenerationError,
    )
  })

  it('tolerates a ```json fenced provider response', async () => {
    const fenced =
      '```json\n' +
      JSON.stringify({
        titles: ['t1', 't2', 't3', 't4', 't5'],
        body: { hook: 'h', painPoint: 'p', value: 'v', cta: 'c' },
        tags: ['a'],
      }) +
      '\n```'
    const result = await createGenerator(stubProvider(fenced)).generate(
      validRaw,
    )
    expect(result.body.hook).toBe('h')
    expect(result.disclaimer).toBe(RED_LINE_DISCLAIMER)
  })
})
