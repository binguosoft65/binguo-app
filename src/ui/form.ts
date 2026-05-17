// 输入表单 —— 只收用户自填字段,显式无任何洗稿/搬运入口。
//
// 红线① (CMP-8 范围): 表单**刻意不提供**「粘贴文章 / URL / 原文 /
// 改写 / 参考链接」一类输入。可输入项严格等于 core 白名单字段:
//   sellingPoints / topic / platform / goal / style
// 这一约束由 form.test.ts 断言留痕 (扫描整棵表单 DOM 无违禁入口)。
import {
  PLATFORMS,
  GOALS,
  STYLE_IDS,
  PLATFORM_REGISTRY,
  GOAL_REGISTRY,
  STYLE_REGISTRY,
} from '../core'

export interface InputFormHandle {
  form: HTMLFormElement
  /** 读取当前表单值为原始对象,直接喂给 core.assertCleanInput。 */
  read(): Record<string, string>
  /** 用一条历史记录的入参回填表单 (历史「恢复」用)。 */
  fill(values: Record<string, string>): void
}

export interface BuildFormOptions {
  /**
   * 锁定层闸位 (CMP-10 / T4): 「风格 / 行业模板库」是付费能力。
   * 提供回调即在表单内渲染闸位入口 (触发即弹 paywall 占位)。
   * 不提供则不渲染 (免费层基础风格仍可正常选择)。
   */
  onLockedTemplates?: () => void
}

function field(labelText: string, control: HTMLElement): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'field'
  const label = document.createElement('label')
  label.className = 'field-label'
  label.textContent = labelText
  if (control.id) label.htmlFor = control.id
  wrap.append(label, control)
  return wrap
}

function select(
  id: string,
  options: ReadonlyArray<{ value: string; label: string }>,
): HTMLSelectElement {
  const el = document.createElement('select')
  el.id = id
  el.name = id
  for (const opt of options) {
    const o = document.createElement('option')
    o.value = opt.value
    o.textContent = opt.label
    el.append(o)
  }
  return el
}

/**
 * 构造输入表单。返回表单元素与读/填句柄。表单本身不触发生成,
 * 由 app.ts 监听 submit 后经 core 编排 (mock provider) 生成。
 */
export function buildForm(opts: BuildFormOptions = {}): InputFormHandle {
  const form = document.createElement('form')
  form.className = 'input-form'
  form.setAttribute('novalidate', '')
  form.dataset.testid = 'input-form'

  const sellingPoints = document.createElement('textarea')
  sellingPoints.id = 'sellingPoints'
  sellingPoints.name = 'sellingPoints'
  sellingPoints.rows = 3
  sellingPoints.required = true
  sellingPoints.placeholder =
    '用你自己的话写产品/服务的真实卖点,例如:冷萃工艺、0 香精、3 秒回温'

  const topic = document.createElement('textarea')
  topic.id = 'topic'
  topic.name = 'topic'
  topic.rows = 2
  topic.required = true
  topic.placeholder = '你想做的选题,例如:夏天办公室囤什么咖啡'

  const platform = select(
    'platform',
    PLATFORMS.map((p) => ({ value: p, label: PLATFORM_REGISTRY[p].label })),
  )
  const goal = select(
    'goal',
    GOALS.map((g) => ({ value: g, label: GOAL_REGISTRY[g].label })),
  )
  const style = select(
    'style',
    STYLE_IDS.map((s) => ({ value: s, label: STYLE_REGISTRY[s].label })),
  )

  const notice = document.createElement('p')
  notice.className = 'origin-notice'
  notice.dataset.testid = 'origin-notice'
  notice.textContent =
    '本工具只根据你自己填写的卖点与选题原创生成,不抓取、不改写、不洗稿任何已有文章或链接。'

  const submit = document.createElement('button')
  submit.type = 'submit'
  submit.className = 'primary'
  submit.dataset.testid = 'generate-btn'
  submit.textContent = '生成文案'

  form.append(
    field('你的卖点(自填)', sellingPoints),
    field('选题(自填)', topic),
    field('发布平台', platform),
    field('内容目标', goal),
    field('语气风格', style),
  )

  // 锁定层闸位 (CMP-10 / T4): 风格/行业模板库 = 付费能力。
  // 这是一个 <button>(非命名输入控件),不进入红线① 表单白名单扫描。
  if (opts.onLockedTemplates) {
    const lockedTpl = document.createElement('button')
    lockedTpl.type = 'button'
    lockedTpl.className = 'locked-feature ghost'
    lockedTpl.dataset.testid = 'locked-templates-btn'
    lockedTpl.textContent = '🔒 解锁更多风格 / 行业模板库'
    lockedTpl.addEventListener('click', () => opts.onLockedTemplates?.())
    form.append(lockedTpl)
  }

  form.append(notice, submit)

  const read = (): Record<string, string> => ({
    sellingPoints: sellingPoints.value,
    topic: topic.value,
    platform: platform.value,
    goal: goal.value,
    style: style.value,
  })

  const fill = (values: Record<string, string>): void => {
    if (typeof values.sellingPoints === 'string')
      sellingPoints.value = values.sellingPoints
    if (typeof values.topic === 'string') topic.value = values.topic
    if (typeof values.platform === 'string') platform.value = values.platform
    if (typeof values.goal === 'string') goal.value = values.goal
    if (typeof values.style === 'string') style.value = values.style
  }

  return { form, read, fill }
}
