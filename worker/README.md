# 缤果文案台 LLM 代理 (Cloudflare Worker · CMP-9 / T2)

极薄 serverless 代理。前端是 GitHub Pages 静态站,LLM API Key **绝不能**
进客户端 bundle —— 本 Worker 服务端持 Key,并对红线 ①②③ 做服务端强制
兜底。架构依据:[CMP-5 plan §3](/CMP/issues/CMP-5#document-plan)。

## 设计契约

- **Key 服务端持有**:`LLM_API_KEY` 仅作 Worker secret 注入,绝不入仓 /
  `wrangler.toml` / 客户端。仓库内全程 **keyless**。
- **红线服务端兜底**(单一事实来源 = `../src/core`,代理不旁路):
  - ① `assertCleanInput` 拒绝洗稿/搬运/越界字段 → `422 rewrite_entry_forbidden` / `url_in_user_input`
  - ② 入参白名单 + 类型/枚举校验 → `422 unknown_field` / `missing_field` / `invalid_value`
  - ③ `enforceDisclaimer` 末尾强制注入规范免责,调用方/上游模型不可剥离
- **provider 选择**:`LLM_API_KEY` + `LLM_BASE_URL` + `LLM_MODEL` 三者齐备
  才接真供应商;否则确定性降级到 mock。→ mock 端到端可跑 + 真 adapter 就绪。
- **计次信号**:每次成功生成发一条结构化 count 信号(结构化日志 +
  `X-Binguo-Count` 响应头 + 响应体 `count`)。**不含 PII**。计量归
  [CMP-10](/CMP/issues/CMP-10) (T4 paywall),支付归 [CMP-6](/CMP/issues/CMP-6)。

## 路由

| 方法 | 路径        | 说明                                            |
| ---- | ----------- | ----------------------------------------------- |
| GET  | `/health`   | `{status:"ok", provider:"mock"\|"http"}`,无密钥泄露 |
| POST | `/generate` | 入参 = 用户自填 `{sellingPoints,topic,platform,goal,style}` |
| OPTIONS | 任意     | CORS 预检 (仅白名单 Origin)                      |

## 本地验证 ($0,无需 Cloudflare 账号)

```bash
# 服务端红线 + 路由单测 (CEO 上线门④ 代理层留痕)
npm run test:run
# Worker 类型检查 (已并入根 `npm run typecheck`,CI 覆盖)
npm run typecheck
```

## 部署 (⚠️ gated — CMP-5 §6 board approval 之后才执行)

接真 key + 公开上线**不在本仓库范围**,是 CMP-5 集成步,须先过 §6 董事会
审批(LLM 供应商选型 + Key 取得 + 花费上限)。批准后由部署者执行:

```bash
npx wrangler deploy                       # 部署 Worker (Free 计划 $0)
npx wrangler secret put LLM_API_KEY       # 注入真 key (绝不入仓)
npx wrangler secret put LLM_BASE_URL      # 供应商端点 (§6 选定)
npx wrangler secret put LLM_MODEL         # 模型名
```

部署后冒烟:`curl https://<worker>/health` 期望 `provider:"http"`;
`curl -X POST .../generate -d '{...自填...}'` 期望返回结构化文案且末尾含规范免责。
凭据存放位置记入公司 `TOOLS.md`(不写密钥本身)。
