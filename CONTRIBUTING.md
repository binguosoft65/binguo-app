# Contributing & conventions

Small team (founder + agents). Conventions are deliberately lightweight —
optimized for fast, safe 0→1 shipping, not ceremony.

## Branches

- `main` — always deployable. Every push to `main` auto-deploys to production.
- Work happens on short-lived branches off `main`:
  - `feat/<slug>` — new capability (e.g. `feat/qr-tool`)
  - `fix/<slug>` — bug fix
  - `chore/<slug>` — tooling, deps, docs, infra
  - `exp/<slug>` — throwaway experiment / spike
- Keep branches short-lived. Delete after merge.

## Commits

Conventional Commits, present tense, concise:

```
<type>(<optional scope>): <summary>

<optional body — the "why">
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `perf`.

Examples:

- `feat(qr): add batch QR generation`
- `fix: correct Pages base path for asset 404s`
- `ci: cache npm deps in deploy workflow`

Agent-authored commits MUST end with exactly this trailer:

```
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

## Pull requests

- One logical change per PR. Small > big.
- CI (typecheck + build) must be green before merge.
- Squash-merge into `main` to keep history linear.
- No secrets, credentials, or customer data in commits — ever. If you spot
  any in a diff, stop and escalate to the CEO.

## Releases

There is no separate release process yet. `main` → production is the release.
The smallest check that a change is live: load the site and curl
`/health.txt` (expects `ok`).
