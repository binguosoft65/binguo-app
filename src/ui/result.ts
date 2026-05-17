// 结果区 —— 5 爆款标题 + 结构化正文 (钩子-痛点-价值-CTA) + 话题标签
// + 一键复制 + 收藏 + 免费层署名水印。
//
// 免责声明 (红线③) 由 core 强制注入,既渲染在结果区底部,也由 app.ts
// 渲染为全站固定页脚 (两处都不可被剥离)。
import type { GenerationResult } from '../core'
import { renderShareText, hasWatermark, FREE_TIER_WATERMARK } from './watermark'
import type { Tier } from './watermark'

export interface ResultPanelOptions {
  tier?: Tier
  favorite?: boolean
  /** 复制成功/失败回调 (用于 UI 反馈与测试桩)。 */
  onCopy?: (text: string, ok: boolean) => void
  /** 切换收藏。未提供则不渲染收藏按钮。 */
  onToggleFavorite?: () => void
}

function section(title: string, value: string): HTMLElement {
  const box = document.createElement('div')
  box.className = 'body-section'
  const h = document.createElement('h4')
  h.textContent = title
  const p = document.createElement('p')
  p.textContent = value
  box.append(h, p)
  return box
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const clip = globalThis.navigator?.clipboard
    if (clip && typeof clip.writeText === 'function') {
      await clip.writeText(text)
      return true
    }
  } catch {
    /* fall through to non-fatal failure */
  }
  return false
}

/**
 * 渲染结果面板。`tier` 默认 `free` —— 免费层复制文本必带署名水印
 * (分发楔子,不可砍);付费层 (T4) 才去署名。
 */
export function renderResultPanel(
  result: GenerationResult,
  opts: ResultPanelOptions = {},
): HTMLElement {
  const tier: Tier = opts.tier ?? 'free'
  const root = document.createElement('section')
  root.className = 'result-panel'
  root.dataset.testid = 'result-panel'

  // —— 候选标题 ×5 ——
  const titlesWrap = document.createElement('div')
  titlesWrap.className = 'titles'
  const titlesH = document.createElement('h3')
  titlesH.textContent = '5 个候选标题'
  const ol = document.createElement('ol')
  ol.dataset.testid = 'titles'
  for (const t of result.titles) {
    const li = document.createElement('li')
    li.textContent = t
    ol.append(li)
  }
  titlesWrap.append(titlesH, ol)

  // —— 结构化正文: 钩子 → 痛点 → 价值 → CTA ——
  const bodyWrap = document.createElement('div')
  bodyWrap.className = 'body'
  bodyWrap.dataset.testid = 'body'
  const bodyH = document.createElement('h3')
  bodyH.textContent = '结构化正文'
  bodyWrap.append(
    bodyH,
    section('钩子', result.body.hook),
    section('痛点', result.body.painPoint),
    section('价值', result.body.value),
    section('行动号召 (CTA)', result.body.cta),
  )

  // —— 话题标签 ——
  const tagsWrap = document.createElement('div')
  tagsWrap.className = 'tags'
  tagsWrap.dataset.testid = 'tags'
  const tagsH = document.createElement('h3')
  tagsH.textContent = '话题标签'
  const tagList = document.createElement('div')
  tagList.className = 'tag-list'
  for (const tag of result.tags) {
    const chip = document.createElement('span')
    chip.className = 'tag'
    chip.textContent = `#${tag}`
    tagList.append(chip)
  }
  tagsWrap.append(tagsH, tagList)

  // —— 操作: 一键复制 / 收藏 ——
  const actions = document.createElement('div')
  actions.className = 'result-actions'

  const copyBtn = document.createElement('button')
  copyBtn.type = 'button'
  copyBtn.className = 'primary'
  copyBtn.dataset.testid = 'copy-btn'
  copyBtn.textContent = '一键复制全文'
  const shareText = renderShareText(result, tier)
  copyBtn.addEventListener('click', () => {
    void copyToClipboard(shareText).then((ok) => {
      copyBtn.textContent = ok ? '已复制 ✓' : '复制失败,请手动选择'
      opts.onCopy?.(shareText, ok)
      window.setTimeout(() => {
        copyBtn.textContent = '一键复制全文'
      }, 2000)
    })
  })
  actions.append(copyBtn)

  if (opts.onToggleFavorite) {
    const favBtn = document.createElement('button')
    favBtn.type = 'button'
    favBtn.className = 'ghost'
    favBtn.dataset.testid = 'favorite-btn'
    favBtn.textContent = opts.favorite ? '★ 已收藏' : '☆ 收藏'
    favBtn.addEventListener('click', () => opts.onToggleFavorite?.())
    actions.append(favBtn)
  }

  // —— 免费层署名水印 (分发楔子,不可砍) ——
  if (hasWatermark(tier)) {
    const wm = document.createElement('p')
    wm.className = 'watermark'
    wm.dataset.testid = 'watermark'
    wm.textContent = FREE_TIER_WATERMARK
    root.append(titlesWrap, bodyWrap, tagsWrap, actions, wm)
  } else {
    root.append(titlesWrap, bodyWrap, tagsWrap, actions)
  }

  // —— 结果区内嵌免责 (红线③);全站固定页脚另由 app.ts 渲染 ——
  const disclaimer = document.createElement('p')
  disclaimer.className = 'result-disclaimer'
  disclaimer.dataset.testid = 'result-disclaimer'
  disclaimer.textContent = result.disclaimer
  root.append(disclaimer)

  return root
}
