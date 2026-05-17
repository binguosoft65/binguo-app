// 缤果文案台 —— 入口。
//
// 当前用 T1 (CMP-7) 的确定性 MockLlmProvider:无需任何真实 key 即可
// 本地跑通「输入 → 结果」闭环 (CMP-8 Done 判据)。接真 LLM 由 T2
// (CMP-9 serverless 代理) 在服务端注入,需 CEO 上线门审批。
import './style.css'
import { initErrorReporter } from './error-reporter'
import { createGenerator, MockLlmProvider } from './core'
import { mountApp } from './ui/app'

initErrorReporter()

const root = document.querySelector<HTMLDivElement>('#app')
if (root) {
  const generator = createGenerator(new MockLlmProvider())
  mountApp(root, { generator, tier: 'free' })
}
