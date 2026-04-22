# Drone Delivery Ops

A web app for a professional flying drone operator to execute a delivery run: multiple pickups
(restaurants) and multiple dropoffs (residences). The operator sees where to go on a map, checks
off arrival/departure, and marks each stop as success or failure.

## Prerequisites

- Node.js **20 or newer**
- **pnpm** (https://pnpm.io/installation) — this project uses a single `pnpm-lock.yaml`. Do not
  mix package managers.

## Install

```bash
pnpm install
```

## Run (local dev)

```bash
pnpm dev
```

Open <http://localhost:5173>. Login with any non-empty operator id and PIN — credentials are
mocked.

## Commands

| Command            | Description                                                       |
| ------------------ | ----------------------------------------------------------------- |
| `pnpm dev`         | Start the Vite dev server at <http://localhost:5173>              |
| `pnpm build`       | Type-check and produce a production build into `dist/`            |
| `pnpm preview`     | Preview the production build locally                              |
| `pnpm typecheck`   | Run `tsc --noEmit` across the project                             |
| `pnpm test`        | Run Vitest unit tests once (jsdom env, colocated `*.test.ts(x)`)  |
| `pnpm test:watch`  | Run Vitest in watch mode                                          |
| `pnpm test:e2e`    | Run Playwright E2E + visual suite (auto-starts dev server)        |
| `pnpm lint`        | Run ESLint across the project                                     |
| `pnpm format`      | Format the codebase with Prettier                                 |
| `pnpm format:check`| Check Prettier formatting without writing                         |

## Project structure

```
src/
  app/        App shell (router, providers)
  features/   Feature-based modules: auth, route, map, stops, summary
  lib/        Shared domain types, theme tokens, constants, mock data
  tests/      Playwright E2E (e2e/) and visual (visual/) suites
```

Full architecture, contracts, workstream boundaries, and state-machine rules live in
[`PLAN.md`](./PLAN.md). Read it before extending the app.

## Testing notes

- **Unit tests** use Vitest + React Testing Library, colocated next to the code they cover
  (`*.test.ts` / `*.test.tsx`). They run under `jsdom`.
- **E2E + visual tests** use Playwright, live under `src/tests/e2e/` and `src/tests/visual/`, and
  auto-start the dev server via `playwright.config.ts`. Visual snapshots are stored at
  `src/tests/visual/__snapshots__/`.
- Interactive elements have `data-testid` attributes following `<feature>-<element>[-<id>]` so
  selectors stay stable.

## Mock credentials

Login is mocked. Any non-empty **Operator ID** plus any non-empty **PIN** logs you in.
