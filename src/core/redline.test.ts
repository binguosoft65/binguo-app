// 红线守门模块单测 — CEO 上线门 ④ 要求的可验证测试留痕。
// 覆盖 CMP-5 plan §5 的三条红线:
//   ① 无洗稿入口   — 硬拒绝任何 article/url/改写 字段
//   ② 仅基于自填   — 入参 schema 仅含用户自填白名单字段
//   ③ 固定免责     — 免责文案强制注入,调用方不可覆盖/剥离
import { describe, it, expect } from 'vitest'
import {
  assertCleanInput,
  enforceDisclaimer,
  RedLineError,
  RED_LINE_DISCLAIMER,
} from './redline'

const validRaw = {
  sellingPoints: '冷萃工艺,0 香精,3 秒回温',
  topic: '夏天办公室囤什么咖啡',
  platform: 'xiaohongshu',
  goal: 'seed',
  style: 'warm_sharing',
}

describe('红线② 仅基于用户自填 (only-user-filled allowlist schema)', () => {
  it('accepts a valid user-filled input and returns a typed clean object', () => {
    const clean = assertCleanInput(validRaw)
    expect(clean).toEqual(validRaw)
  })

  it('hard-rejects any unknown/extra field (no scraping/retrieval fields)', () => {
    // Use a semantically-neutral extra key: a scraping/rewrite-named key
    // is intentionally caught earlier by 红线① (see test below), which is
    // the stronger, desired behavior.
    expect(() => assertCleanInput({ ...validRaw, nickname: 'x' })).toThrow(
      RedLineError,
    )
    try {
      assertCleanInput({ ...validRaw, nickname: 'x' })
    } catch (e) {
      expect((e as RedLineError).code).toBe('unknown_field')
    }
  })

  it('rejects a missing required field', () => {
    const { topic, ...noTopic } = validRaw
    void topic
    try {
      assertCleanInput(noTopic)
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(RedLineError)
      expect((e as RedLineError).code).toBe('missing_field')
    }
  })

  it('rejects an out-of-enum platform / goal value', () => {
    try {
      assertCleanInput({ ...validRaw, platform: 'wechat' })
      throw new Error('should have thrown')
    } catch (e) {
      expect((e as RedLineError).code).toBe('invalid_value')
    }
    try {
      assertCleanInput({ ...validRaw, goal: 'hack' })
      throw new Error('should have thrown')
    } catch (e) {
      expect((e as RedLineError).code).toBe('invalid_value')
    }
  })

  it('rejects empty / whitespace-only user text (must be genuinely user-filled)', () => {
    try {
      assertCleanInput({ ...validRaw, sellingPoints: '   ' })
      throw new Error('should have thrown')
    } catch (e) {
      expect((e as RedLineError).code).toBe('invalid_value')
    }
  })

  it('rejects non-object input', () => {
    expect(() => assertCleanInput('a string' as unknown)).toThrow(RedLineError)
    expect(() => assertCleanInput(null as unknown)).toThrow(RedLineError)
  })
})

describe('红线① 无洗稿入口 (no rewrite / paste-other-content entry)', () => {
  const forbidden = [
    'article',
    'articleText',
    'url',
    'sourceUrl',
    'link',
    'rewrite',
    'rewriteFrom',
    'originalText',
    'reference',
    'content',
    'html',
  ]

  for (const field of forbidden) {
    it(`hard-rejects "${field}" as a rewrite/洗稿 entry`, () => {
      try {
        assertCleanInput({ ...validRaw, [field]: 'whatever' })
        throw new Error('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(RedLineError)
        // Must be the specific 洗稿 code, not generic unknown_field,
        // so the violation is unambiguous in the test trace.
        expect((e as RedLineError).code).toBe('rewrite_entry_forbidden')
      }
    })
  }

  it('catches scraping/crawl-named fields by word-root, not just exact name', () => {
    for (const field of ['scrapedFrom', 'crawlSource', 'articleUrl']) {
      try {
        assertCleanInput({ ...validRaw, [field]: 'x' })
        throw new Error('should have thrown')
      } catch (e) {
        expect((e as RedLineError).code).toBe('rewrite_entry_forbidden')
      }
    }
  })

  it('rejects a URL smuggled inside an allowed user field', () => {
    try {
      assertCleanInput({
        ...validRaw,
        topic: '把这篇 https://example.com/post 改写一下',
      })
      throw new Error('should have thrown')
    } catch (e) {
      expect((e as RedLineError).code).toBe('url_in_user_input')
    }
  })
})

describe('红线③ 固定免责强制注入 (forced disclaimer, non-overridable)', () => {
  it('RED_LINE_DISCLAIMER carries the mandatory obligations', () => {
    expect(typeof RED_LINE_DISCLAIMER).toBe('string')
    expect(RED_LINE_DISCLAIMER.length).toBeGreaterThan(10)
    expect(RED_LINE_DISCLAIMER).toContain('核实')
    expect(RED_LINE_DISCLAIMER).toContain('夸大')
    expect(RED_LINE_DISCLAIMER).toContain('效果')
  })

  it('overrides any caller-supplied disclaimer with the canonical text', () => {
    const out = enforceDisclaimer({
      disclaimer: '免责声明已被删除',
      body: '正文内容',
    })
    expect(out.disclaimer).toBe(RED_LINE_DISCLAIMER)
  })

  it('injects the disclaimer even when none was provided', () => {
    const out = enforceDisclaimer({ body: '正文内容' })
    expect(out.disclaimer).toBe(RED_LINE_DISCLAIMER)
  })
})
