// Paywall 闸位占位组件 (CMP-10 / T4).
//
// 复利资产 (显式标注): 与具体产品无耦合的「触发即展示解锁占位」弹层,
// Q3 第二数字产品可直接复用 —— 传 productName / 自定义文案即可, 闸位
// 卖点自动取自 core 的锁定能力注册表。
//
// 边界 (本轨范围, 红线对齐): **不做收银**。无任何价格、支付表单、
// 跳转收款页 —— 升级 CTA 仅为占位, 真实支付集成 = 下游 CMP-6。
// 文案克制, 不夸大、不承诺效果 (红线: 不虚假宣传)。
import { LOCKED_CAPABILITY_IDS, LOCKED_CAPABILITIES } from '../core'
import type { LockedCapability } from '../core'

export type PaywallReason = 'quota_exhausted' | 'locked_capability'

export interface PaywallOptions {
  /** 触发入口: 免费额度耗尽 / 触碰某锁定能力。 */
  reason: PaywallReason
  /** reason=locked_capability 时, 被触碰的能力。 */
  capability?: LockedCapability
  /** 产品名 (Q3 复用时改这里)。 */
  productName?: string
  /** 关闭弹层 (点 × 或遮罩)。 */
  onClose?: () => void
  /** 升级意向 (占位, 不收款) —— 宿主可埋点 / 引导留资。 */
  onUpgradeIntent?: () => void
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
 * 渲染 paywall 占位弹层。返回遮罩根节点 (宿主自行 append/移除)。
 * 升级 CTA 是**占位**: 点击只显示「即将开放」提示并回调意向,
 * 绝不触发任何收款 (真实支付 = 下游 CMP-6)。
 */
export function renderPaywall(opts: PaywallOptions): HTMLElement {
  const productName = opts.productName ?? '缤果文案台'

  const overlay = el('div', 'paywall-overlay')
  overlay.dataset.testid = 'paywall'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')

  const dialog = el('div', 'paywall-dialog')

  const closeBtn = el('button', 'paywall-close ghost', '✕')
  closeBtn.type = 'button'
  closeBtn.dataset.testid = 'paywall-close-btn'
  closeBtn.setAttribute('aria-label', '关闭')
  closeBtn.addEventListener('click', () => opts.onClose?.())

  const cap =
    opts.reason === 'locked_capability' && opts.capability
      ? LOCKED_CAPABILITIES[opts.capability]
      : null

  const heading =
    opts.reason === 'quota_exhausted'
      ? `今日免费额度已用完`
      : `「${cap?.label ?? '该能力'}」是解锁能力`

  const lead =
    opts.reason === 'quota_exhausted'
      ? `免费版每天可生成有限次数。解锁后即享「${LOCKED_CAPABILITIES.unlimited.label}」,不再受每日额度限制。`
      : `${cap?.desc ?? ''}解锁后即可使用。`

  const benefitsTitle = el('p', 'paywall-benefits-title', '解锁后你将获得:')
  const benefits = el('ul', 'paywall-benefits')
  benefits.dataset.testid = 'paywall-benefits'
  for (const id of LOCKED_CAPABILITY_IDS) {
    const c = LOCKED_CAPABILITIES[id]
    const li = el('li')
    li.append(
      el('strong', 'paywall-benefit-label', c.label),
      el('span', 'paywall-benefit-desc', ` —— ${c.desc}`),
    )
    benefits.append(li)
  }

  const upgradeBtn = el('button', 'paywall-upgrade primary', '升级解锁全部能力')
  upgradeBtn.type = 'button'
  upgradeBtn.dataset.testid = 'paywall-upgrade-btn'

  const placeholderNote = el(
    'p',
    'paywall-placeholder-note',
    '支付通道即将开放(占位),敬请期待;开通前可继续免费使用基础能力。',
  )
  placeholderNote.dataset.testid = 'paywall-placeholder-note'
  placeholderNote.hidden = true

  upgradeBtn.addEventListener('click', () => {
    // 占位: 绝不收款。仅显示提示 + 回调意向 (真实支付 = 下游 CMP-6)。
    placeholderNote.hidden = false
    opts.onUpgradeIntent?.()
  })

  const continueBtn = el('button', 'paywall-continue ghost', '继续免费使用')
  continueBtn.type = 'button'
  continueBtn.dataset.testid = 'paywall-continue-btn'
  continueBtn.addEventListener('click', () => opts.onClose?.())

  const footnote = el(
    'p',
    'paywall-footnote',
    `${productName} · 升级为占位演示,当前不收取任何费用。`,
  )

  const actions = el('div', 'paywall-actions')
  actions.append(upgradeBtn, continueBtn)

  dialog.append(
    closeBtn,
    el('h2', 'paywall-heading', heading),
    el('p', 'paywall-lead', lead),
    benefitsTitle,
    benefits,
    actions,
    placeholderNote,
    footnote,
  )

  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) opts.onClose?.()
  })

  overlay.append(dialog)
  return overlay
}
