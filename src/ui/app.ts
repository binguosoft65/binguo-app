// 应用外壳 —— 串起 输入表单 → core 编排(mock) → 结果区 → 历史/收藏,
// 并渲染全站固定免责页脚 (红线③,任何状态下恒在 DOM)。
//
// Done 判据 (CMP-8): 本地 mock 下可跑通「输入 → 结果」闭环。
import type { Generator, GenerationResult, LockedCapability } from '../core'
import { RedLineError, GenerationError } from '../core'
import { RED_LINE_DISCLAIMER } from '../core'
import { peekQuota, consumeQuota } from '../core'
import { buildForm } from './form'
import { renderResultPanel } from './result'
import { renderPaywall } from './paywall'
import type { PaywallReason } from './paywall'
import type { Tier } from './watermark'
import {
  loadHistory,
  addRecord,
  toggleFavorite,
  removeRecord,
  type HistoryRecord,
} from './history'

export interface MountOptions {
  /** 注入的生成器 (main.ts 用 MockLlmProvider 构造;测试可注入桩)。 */
  generator: Generator
  /** 计费层。默认 free —— 输出带署名水印。 */
  tier?: Tier
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/**
 * 挂载应用到给定根节点。返回卸载函数 (测试隔离用)。
 */
export function mountApp(root: HTMLElement, opts: MountOptions): () => void {
  const tier: Tier = opts.tier ?? 'free'
  root.replaceChildren()

  const shell = el('main', 'binguo-app')

  const header = el('header', 'app-header')

  // —— 计次徽标 (CMP-10 / T4): 免费层每日剩余次数, 实时反映闸位状态 ——
  const quotaBadge = el('p', 'quota-badge')
  quotaBadge.dataset.testid = 'quota-badge'
  function renderQuotaBadge(): void {
    if (tier === 'paid') {
      quotaBadge.textContent = '已解锁 · 无限次生成'
      return
    }
    const q = peekQuota()
    quotaBadge.textContent = q.exhausted
      ? `免费版 · 今日 ${q.limit} 次已用完,升级解锁无限次`
      : `免费版 · 今日剩余 ${q.remaining}/${q.limit} 次`
  }

  header.append(
    el('h1', 'app-title', '缤果文案台'),
    el(
      'p',
      'app-tagline',
      '自填卖点 + 选题 → 原创爆款标题与结构化正文 · 不洗稿 · 不搬运',
    ),
    quotaBadge,
  )

  // —— Paywall 闸位占位管理 (单实例; 真实支付=下游 CMP-6, 本轨不收银) ——
  let paywallEl: HTMLElement | null = null
  function closePaywall(): void {
    paywallEl?.remove()
    paywallEl = null
  }
  function openPaywall(
    reason: PaywallReason,
    capability?: LockedCapability,
  ): void {
    closePaywall()
    paywallEl = renderPaywall({ reason, capability, onClose: closePaywall })
    shell.append(paywallEl)
  }

  const { form, read, fill } = buildForm({
    // 锁定层闸位: 风格/行业模板库 = 付费能力, 触发即占位。
    onLockedTemplates:
      tier === 'free'
        ? () => openPaywall('locked_capability', 'template_library')
        : undefined,
  })

  const resultRegion = el('div', 'result-region')
  resultRegion.dataset.testid = 'result-region'

  const errorBox = el('p', 'error-box')
  errorBox.dataset.testid = 'error-box'
  errorBox.hidden = true

  // —— 历史 / 收藏 ——
  let showFavoritesOnly = false
  const historyRegion = el('section', 'history-region')
  historyRegion.dataset.testid = 'history-region'
  const historyHeader = el('div', 'history-header')
  const historyTitle = el('h3', undefined, '历史记录')
  const favFilterBtn = el('button', 'ghost', '只看收藏')
  favFilterBtn.type = 'button'
  favFilterBtn.dataset.testid = 'fav-filter-btn'
  favFilterBtn.addEventListener('click', () => {
    showFavoritesOnly = !showFavoritesOnly
    favFilterBtn.textContent = showFavoritesOnly ? '查看全部' : '只看收藏'
    renderHistory()
  })
  historyHeader.append(historyTitle, favFilterBtn)
  const historyList = el('ul', 'history-list')
  historyList.dataset.testid = 'history-list'
  historyRegion.append(historyHeader, historyList)

  function showResult(
    result: GenerationResult,
    recordId: string,
    favorite: boolean,
  ): void {
    resultRegion.replaceChildren(
      renderResultPanel(result, {
        tier,
        favorite,
        onToggleFavorite: () => {
          toggleFavorite(recordId)
          const rec = loadHistory().find((r) => r.id === recordId)
          showResult(result, recordId, rec?.favorite ?? !favorite)
          renderHistory()
        },
        // 锁定层闸位 (CMP-10 / T4): 免费层只给闸位入口, 不交付能力。
        ...(tier === 'free'
          ? {
              onUnlockLongBody: () =>
                openPaywall('locked_capability', 'long_body'),
              onUnlockWatermarkFree: () =>
                openPaywall('locked_capability', 'watermark_free_export'),
            }
          : {}),
      }),
    )
  }

  function renderHistory(): void {
    const all = loadHistory()
    const records = showFavoritesOnly
      ? all.filter((r) => r.favorite)
      : all
    historyList.replaceChildren()
    if (records.length === 0) {
      const empty = el(
        'li',
        'history-empty',
        showFavoritesOnly ? '还没有收藏。' : '还没有历史记录。',
      )
      historyList.append(empty)
      return
    }
    for (const rec of records) {
      historyList.append(historyItem(rec))
    }
  }

  function historyItem(rec: HistoryRecord): HTMLElement {
    const li = el('li', 'history-item')
    li.dataset.recordId = rec.id

    const meta = el('div', 'history-meta')
    const when = new Date(rec.createdAt).toLocaleString('zh-CN')
    meta.append(
      el('span', 'history-topic', rec.input.topic),
      el('span', 'history-sub', `${rec.input.platform} · ${when}`),
    )

    const ops = el('div', 'history-ops')

    const openBtn = el('button', 'ghost', '查看')
    openBtn.type = 'button'
    openBtn.addEventListener('click', () =>
      showResult(rec.result, rec.id, rec.favorite),
    )

    const restoreBtn = el('button', 'ghost', '回填表单')
    restoreBtn.type = 'button'
    restoreBtn.addEventListener('click', () =>
      fill(rec.input as unknown as Record<string, string>),
    )

    const favBtn = el(
      'button',
      'ghost',
      rec.favorite ? '★ 已收藏' : '☆ 收藏',
    )
    favBtn.type = 'button'
    favBtn.addEventListener('click', () => {
      toggleFavorite(rec.id)
      renderHistory()
    })

    const delBtn = el('button', 'ghost danger', '删除')
    delBtn.type = 'button'
    delBtn.addEventListener('click', () => {
      removeRecord(rec.id)
      renderHistory()
    })

    ops.append(openBtn, restoreBtn, favBtn, delBtn)
    li.append(meta, ops)
    return li
  }

  let busy = false
  form.addEventListener('submit', (ev) => {
    ev.preventDefault()
    if (busy) return
    // 闸位 (CMP-10 / T4 Done): 免费额度耗尽 → 触发 paywall, 不再生成。
    if (tier === 'free' && peekQuota().exhausted) {
      openPaywall('quota_exhausted')
      return
    }
    busy = true
    errorBox.hidden = true
    errorBox.textContent = ''
    const raw = read()
    void opts.generator
      .generate(raw)
      .then((result) => {
        const list = addRecord(
          // core 已对 raw 做白名单收敛;历史存 core 校验后的入参形态。
          {
            sellingPoints: raw.sellingPoints.trim(),
            topic: raw.topic.trim(),
            platform: result.meta.platform,
            goal: result.meta.goal,
            style: result.meta.style,
          },
          result,
        )
        const rec = list[0]
        showResult(result, rec.id, rec.favorite)
        renderHistory()
        // 生成成功才计次 (红线错误/失败不扣额度)。
        if (tier === 'free') consumeQuota()
        renderQuotaBadge()
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof RedLineError
            ? err.message
            : err instanceof GenerationError
              ? err.message
              : '生成失败,请稍后重试。'
        errorBox.textContent = msg
        errorBox.hidden = false
      })
      .finally(() => {
        busy = false
      })
  })

  // —— 固定免责页脚 (红线③) —— 任何状态下恒在 DOM,不依赖是否已生成。
  const footer = el('footer', 'disclaimer-footer')
  footer.dataset.testid = 'disclaimer-footer'
  footer.textContent = RED_LINE_DISCLAIMER

  shell.append(
    header,
    form,
    errorBox,
    resultRegion,
    historyRegion,
    footer,
  )
  root.append(shell)

  renderQuotaBadge()
  renderHistory()

  return () => root.replaceChildren()
}
