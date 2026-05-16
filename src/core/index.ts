// 复利生成核心 —— 公共契约入口。
//
// T2 (CMP-9 serverless 代理) 与 T3 (CMP-8 生成 UI) 一律从此处引用,
// 不得绕过红线模块直接拼接 LLM 调用。
export {
  PLATFORMS,
  GOALS,
  STYLE_IDS,
  RED_LINE_DISCLAIMER,
  ALLOWED_FIELDS,
  FORBIDDEN_FIELDS,
} from './schema'
export type { Platform, Goal, StyleId, GenerationInput } from './schema'

export {
  assertCleanInput,
  checkNoRewriteEntry,
  checkOnlyUserFilled,
  enforceDisclaimer,
  RedLineError,
} from './redline'
export type { RedLineCode } from './redline'

export {
  PLATFORM_REGISTRY,
  GOAL_REGISTRY,
  STYLE_REGISTRY,
  buildPrompt,
} from './templates'
export type { Profile, BuiltPrompt } from './templates'

export { MockLlmProvider, createHttpLlmProvider } from './llm'
export type {
  LlmProvider,
  LlmRequest,
  LlmResponse,
  HttpLlmConfig,
} from './llm'

export { createGenerator, renderResult, GenerationError } from './generate'
export type {
  Generator,
  GenerationResult,
  GenerationBody,
} from './generate'
