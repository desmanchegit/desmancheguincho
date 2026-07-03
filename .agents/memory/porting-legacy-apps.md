---
name: Porting legacy full-stack apps into pnpm-workspace
description: Lessons from porting an existing Express/SQLite/React app (with real data) into the pnpm-workspace artifact structure.
---

- If the legacy app has an existing database with real data (e.g. a `.sqlite` file), keep the original DB engine instead of migrating to Postgres. Copy the DB file into the new `api-server` artifact and point the driver at it relative to the bundled `dist` dir via `import.meta.url`, not `process.cwd()`.
  **Why:** Migrating to Postgres mid-port risks losing/corrupting real production data and adds unnecessary schema-translation risk.
  **How to apply:** Keep `lib/db` (the workspace Postgres package) untouched/unused for this artifact. Import schema *types only* from `@workspace/db/schema`, never from `@workspace/db` itself — importing the package root triggers `lib/db/src/index.ts`, which eagerly opens a Postgres pool and throws if `DATABASE_URL` isn't set, even though the legacy app doesn't need Postgres at all.

- Legacy apps typically weren't written against `noImplicitReturns: true` (part of this workspace's shared `tsconfig.base.json`). Porting a large legacy `routes.ts` file can produce dozens of TS7030 errors that are cosmetic, not correctness issues.
  **Why:** Patching every callsite is high-effort with no functional benefit for ported code you don't plan to restructure.
  **How to apply:** Add `"noImplicitReturns": false` as a per-artifact tsconfig override for the ported backend package rather than editing every route handler.

- Express 5 types `req.params.<name>` as `string | string[]`, which breaks legacy code written for Express 4 (implicit `string`). Fix at destructure time with `const { id } = req.params as { id: string }` rather than casting at every use site.

- When porting a Vite+React client that used a single-repo `vite.config.ts` (root pointed at `client/`, alias `@assets` → `attached_assets` outside the client root), the new artifact's Vite server needs `fs.strict: false` since `attached_assets` now lives outside the artifact directory (workspace root), and `wouter`'s `<Router>` must get `base={import.meta.env.BASE_URL.replace(/\/$/, "")}` or in-app navigation silently breaks once the artifact isn't served at the domain root during composition with other artifacts.
