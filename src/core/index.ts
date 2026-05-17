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

// —— 计费层闸位 + 每日计次 (CMP-10 / T4, 复利可复用 Q3) ——
export {
  FREE_DAILY_LIMIT,
  FREE_BODY_PREVIEW_CHARS,
  LOCKED_CAPABILITY_IDS,
  LOCKED_CAPABILITIES,
  isCapabilityLocked,
  unlockedCapabilities,
  clampBodyForTier,
} from './entitlements'
export type { Tier, LockedCapability, Capability } from './entitlements'

export { peekQuota, consumeQuota, resetQuota } from './quota'
export type { QuotaState, QuotaScope } from './quota'
