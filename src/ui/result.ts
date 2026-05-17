// 结果区 —— 5 爆款标题 + 结构化正文 (钩子-痛点-价值-CTA) + 话题标签
// + 一键复制 + 收藏 + 免费层署名水印。
//
// 免责声明 (红线③) 由 core 强制注入,既渲染在结果区底部,也由 app.ts
// 渲染为全站固定页脚 (两处都不可被剥离)。
import type { GenerationResult } from '../core'
import { clampBodyForTier } from '../core'
import { renderShareText, hasWatermark, FREE_TIER_WATERMARK } from './watermark'
import type { Tier } from './watermark'

export interface ResultPanelOptions {
  tier?: Tier
  favorite?: boolean
  /** 复制成功/失败回调 (用于 UI 反馈与测试桩)。 */
  onCopy?: (text: string, ok: boolean) => void
  /** 切换收藏。未提供则不渲染收藏按钮。 */
  onToggleFavorite?: () => void
  /**
   * 锁定层闸位 (CMP-10 / T4): 免费层正文为短预览,「完整长正文」
   * 是付费能力。提供回调即在免费层渲染闸位入口 (触发即弹 paywall)。
   */
  onUnlockLongBody?: () => void
  /**
   * 锁定层闸位 (CMP-10 / T4): 免费层导出恒带署名水印,「去水印导出」
   * 是付费能力。提供回调即在免费层渲染闸位入口 (触发即弹 paywall)。
   */
  onUnlockWatermarkFree?: () => void
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
  // 免费层 = 短正文 (长正文是锁定能力, CMP-10 / T4);付费层 = 原样。
  // 收敛同时作用于展示与复制文本,免费层无法绕过取回完整长正文。
  const displayResult: GenerationResult = {
    ...result,
    body: clampBodyForTier(result.body, tier),
  }
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
    section('钩子', displayResult.body.hook),
    section('痛点', displayResult.body.painPoint),
    section('价值', displayResult.body.value),
    section('行动号召 (CTA)', displayResult.body.cta),
  )

  // 锁定层闸位 (CMP-10 / T4): 免费层只给「解锁完整长正文」入口。
  if (tier === 'free' && opts.onUnlockLongBody) {
    const lockHint = document.createElement('p')
    lockHint.className = 'locked-hint'
    lockHint.textContent = '免费版为短正文预览。'
    const unlockLong = document.createElement('button')
    unlockLong.type = 'button'
    unlockLong.className = 'locked-feature ghost'
    unlockLong.dataset.testid = 'unlock-long-body-btn'
    unlockLong.textContent = '🔒 解锁完整长正文'
    unlockLong.addEventListener('click', () => opts.onUnlockLongBody?.())
    bodyWrap.append(lockHint, unlockLong)
  }

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
  const shareText = renderShareText(displayResult, tier)
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

  // 锁定层闸位 (CMP-10 / T4): 免费层导出恒带分发楔子;
  // 「去水印导出」是付费能力 —— 此处只给闸位入口,绝不剥离水印。
  if (tier === 'free' && opts.onUnlockWatermarkFree) {
    const unlockWm = document.createElement('button')
    unlockWm.type = 'button'
    unlockWm.className = 'locked-feature ghost'
    unlockWm.dataset.testid = 'unlock-watermark-free-btn'
    unlockWm.textContent = '🔒 去水印导出'
    unlockWm.addEventListener('click', () =>
      opts.onUnlockWatermarkFree?.(),
    )
    actions.append(unlockWm)
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
