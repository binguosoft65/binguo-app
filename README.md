# binguo-app

缤果软件 (Bingo Software) 的公司应用基座 —— company app foundation & product starter.

> 一个人 + 一群智能体,把软件能力、内容流量和数字产品变成可持续现金流。

This repo is the shared starting point for 缤果's software products. It proves
the build → deploy pipeline end to end with a hello-world page, and every new
paid micro-tool / 小程序 starts from this scaffold (复利沉淀: reuse, don't rebuild).

## Live

- Production: <https://binguosoft65.github.io/binguo-app/>
- Health check: <https://binguosoft65.github.io/binguo-app/health.txt> (returns `ok`)

## Stack (minimal & maintainable, bias to fast 0→1 + low cost)

| Layer       | Choice                | Why                                                            |
| ----------- | --------------------- | -------------------------------------------------------------- |
| Language    | TypeScript            | Type safety, ubiquitous, low ramp-up                           |
| Build / dev | Vite                  | Instant dev server, fast builds, static output, zero config    |
| Hosting     | GitHub Pages          | $0, no card, no extra account — cheapest viable for static     |
| CI/CD       | GitHub Actions        | Native to the repo, free for public repos                      |
| Tests       | Vitest                | Vite-native, zero-config; red-line suite is a CI merge gate    |
| Monitoring  | Console reporter stub | Minimal viable; upgrade path = Sentry free tier (see TOOLS.md) |

No backend yet by design. Tools that need server-side compute will add
Cloudflare Workers (free tier) per product — decided at product time, not now.

## Develop

```bash
npm install      # one-time
npm run dev       # http://localhost:5173
npm run test      # watch-mode unit tests (Vitest)
npm run test:run  # one-shot run (used by CI)
npm run build     # typecheck + production build → dist/
npm run preview   # serve the production build locally
```

Requires Node 22+.

The reusable generation core lives in [`src/core/`](./src/core) — LLM
provider abstraction (mock + real adapter, key never in repo), structured
钩子-痛点-价值-CTA prompt + platform/goal/style template registry, and the
red-line gatekeeper. Downstream products import only from `src/core`.

## Conventions

Branch & commit conventions live in [CONTRIBUTING.md](./CONTRIBUTING.md).
CI (`.github/workflows/ci.yml`) blocks any PR that fails typecheck, the
red-line test suite (CEO 上线门 ④), or build.
Push to `main` auto-deploys via `.github/workflows/deploy.yml`.

## Ownership & license

Proprietary — © 缤果软件 (Bingo Software). All rights reserved. Not for
redistribution. Maintained by the CTO (founding engineer) + agent team.
