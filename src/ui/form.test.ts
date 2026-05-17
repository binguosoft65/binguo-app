/**
 * @vitest-environment jsdom
 */
// 输入表单 UI 测试 —— 红线① 留痕:整棵表单 DOM 无任何洗稿/搬运/改写/
// URL/粘贴原文 入口,可输入项严格等于 core 白名单字段。
import { describe, it, expect } from 'vitest'
import { buildForm } from './form'
import {
  ALLOWED_FIELDS,
  PLATFORMS,
  GOALS,
  STYLE_IDS,
  PLATFORM_REGISTRY,
  GOAL_REGISTRY,
  STYLE_REGISTRY,
} from '../core'

// 任何命中以下词根的输入控件都视为洗稿/搬运入口 —— 必须为零。
const FORBIDDEN_INPUT_HINTS = [
  'article',
  'url',
  'link',
  'rewrite',
  'paraphrase',
  'original',
  'source',
  'reference',
  'crawl',
  'scrape',
  'paste',
  'html',
  '洗稿',
  '改写',
  '搬运',
  '粘贴',
  '链接',
  '原文',
  '网址',
  '参考文章',
]

function controlSignature(el: Element): string {
  return [
    el.getAttribute('name') ?? '',
    el.id,
    el.getAttribute('placeholder') ?? '',
    el.getAttribute('aria-label') ?? '',
  ]
    .join(' ')
    .toLowerCase()
}

describe('红线① 输入表单无洗稿/搬运入口', () => {
  it('exposes exactly the core allowlist fields as named controls', () => {
    const { form } = buildForm()
    const named = Array.from(
      form.querySelectorAll<HTMLElement>('input,textarea,select'),
    )
      .map((c) => c.getAttribute('name'))
      .filter((n): n is string => !!n)
    expect(new Set(named)).toEqual(new Set(ALLOWED_FIELDS))
  })

  it('has NO rewrite / article / URL / paste-source input anywhere in the form', () => {
    const { form } = buildForm()
    const controls = form.querySelectorAll('input,textarea,select')
    for (const c of Array.from(controls)) {
      const sig = controlSignature(c)
      for (const hint of FORBIDDEN_INPUT_HINTS) {
        expect(
          sig.includes(hint),
          `forbidden rewrite/scrape entry detected ("${hint}") in control: ${sig}`,
        ).toBe(false)
      }
    }
  })

  it('renders an explicit "original-only, no scraping/rewriting" notice', () => {
    const { form } = buildForm()
    const notice = form.querySelector<HTMLElement>(
      '[data-testid="origin-notice"]',
    )
    expect(notice?.textContent ?? '').toMatch(/不.*改写|不.*洗稿|不抓取/)
  })
})

describe('表单选项与 core 注册表一致', () => {
  it('platform / goal / style options match the core registries', () => {
    const { form } = buildForm()
    const optionValues = (name: string) =>
      Array.from(
        form.querySelectorAll<HTMLOptionElement>(
          `select[name="${name}"] option`,
        ),
      ).map((o) => o.value)

    expect(optionValues('platform')).toEqual([...PLATFORMS])
    expect(optionValues('goal')).toEqual([...GOALS])
    expect(optionValues('style')).toEqual([...STYLE_IDS])

    const platformLabel = form.querySelector<HTMLOptionElement>(
      'select[name="platform"] option',
    )
    expect(platformLabel?.textContent).toBe(
      PLATFORM_REGISTRY[PLATFORMS[0]].label,
    )
    expect(
      form.querySelector<HTMLOptionElement>('select[name="goal"] option')
        ?.textContent,
    ).toBe(GOAL_REGISTRY[GOALS[0]].label)
    expect(
      form.querySelector<HTMLOptionElement>('select[name="style"] option')
        ?.textContent,
    ).toBe(STYLE_REGISTRY[STYLE_IDS[0]].label)
  })

  it('read() returns the current form values; fill() round-trips', () => {
    const { form, read, fill } = buildForm()
    document.body.append(form)
    fill({
      sellingPoints: '冷萃工艺,0 香精',
      topic: '夏天囤什么咖啡',
      platform: PLATFORMS[0],
      goal: GOALS[0],
      style: STYLE_IDS[0],
    })
    expect(read()).toEqual({
      sellingPoints: '冷萃工艺,0 香精',
      topic: '夏天囤什么咖啡',
      platform: PLATFORMS[0],
      goal: GOALS[0],
      style: STYLE_IDS[0],
    })
    form.remove()
  })
})
