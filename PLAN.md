# Drone Delivery Ops — Implementation Plan v2

> **Single source of truth.** Any agent picking up this project must read this file end-to-end before touching code. All decisions are locked unless a blocker forces renegotiation.

---

## Table of Contents
1. Context
2. Goals / Non-Goals
3. Stack (locked)
4. Standards (authoritative — agents must follow)
5. Architecture & module boundaries
6. Data model
7. State machine
8. Routing map
9. Mock data contract
10. Store API contract (frozen after W1)
11. Theme contract (frozen after W0)
12. Workstream breakdown (W0–W6) — scope, inputs, outputs, DoD
13. Parallelization timeline
14. Blockers & mitigations
15. Verification matrix
16. Post-plan tasks (CLAUDE.md + README.md content)
17. Deliverable inventory
18. Open questions

---

## 1. Context
Technical exercise for **Revelstreet**. Build a web app for a professional flying drone operator to execute a delivery run: multiple pickups (restaurants) → multiple dropoffs (residences). The operator uses the app to see where to go, check off arrival/departure, and mark success/failure.

The exercise (`testRules.md`) explicitly grades on:
- Efficient use of AI agents to autonomously design, build, and test
- Quality of `.md` files (plans, instructions, hooks)
- Quality of instructions given to the coding agent
- Quality of automated testing

It does **not** grade on LOC or feature count. Therefore this plan invests heavily in: clear agent instructions, strict boundaries for parallel execution, and a test pyramid (unit per feature + E2E QA phase).

---

## 2. Goals / Non-Goals

### Goals
- Real, functional, responsive app with strict state transitions and local persistence
- Clean feature decoupling enabling safe parallel subagent execution (no shared-file write conflicts)
- Test pyramid: fast unit tests per feature (agents self-verify) + E2E+visual QA phase (separate agent)
- Dark theme only
- Self-documenting artifacts: this plan, `CLAUDE.md`, `README.md`

### Non-Goals (YAGNI)
- Real backend, real DB, real GPS, real drone integration
- Multi-route queuing, dispatcher/assignment engine, fleet management
- Payments, chat, push notifications, i18n
- Light theme, full a11y audit, ARIA deep-dive
- Top-level error boundary
- Pre-commit hooks (husky, lint-staged)
- Automated conversation-log capture (user handles manually)

---

## 3. Stack (locked)

| Layer | Choice | Notes |
|---|---|---|
| Build | Vite + React 18 + TypeScript (strict) | Fast HMR, industry default |
| Package manager | **pnpm** | Single lockfile |
| Styling | TailwindCSS | Dark mode only, design tokens in `theme.ts` |
| State | Zustand + `persist` middleware | One store per feature; localStorage backend |
| Routing | React Router v6 | `createBrowserRouter` with lazy imports |
| Map | Leaflet + react-leaflet + OpenStreetMap tiles | No API key; OSM has modest rate limits — fine for local demo |
| Unit tests | Vitest + React Testing Library | `jsdom` env, colocated `*.test.ts(x)` |
| E2E + visual | Playwright | E2E at `src/tests/e2e/`, snapshots at `src/tests/visual/` |
| Lint/format | ESLint + Prettier | No pre-commit hook |

### Deps pre-installed by W0 (no agent adds deps after)
- Runtime: `react`, `react-dom`, `react-router-dom`, `zustand`, `leaflet`, `react-leaflet`, `clsx`
- Types: `@types/leaflet`, `@types/react`, `@types/react-dom`, `@types/node`
- Tooling: `typescript`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer`
- Linting: `eslint`, `prettier`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-config-prettier`
- Testing: `vitest`, `@vitest/ui`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `@playwright/test`

If any agent needs a dependency not on this list, **it must halt and report a blocker** — it does not add deps on its own.

---

## 4. Standards (authoritative)

Agents must follow these. Violations = rework.

### 4.1 Naming
- Components: `PascalCase.tsx`; file name equals the primary export name
- Hooks: `useCamelCase.ts` exporting `useX`
- Pure utilities: `camelCase.ts` with named exports
- Test files: same name as subject with `.test.ts(x)` suffix, colocated
- Types: `PascalCase`. Use `interface` for object shapes; `type` for unions/aliases/intersections
- Component Props types: `ComponentNameProps`
- Constants: `SCREAMING_SNAKE_CASE` for module-level frozen values; `camelCase` otherwise

### 4.2 Exports & Imports
- **Named exports only** — never `export default`
- Import order (enforced by ESLint): external libs → `@/*` alias → relative
- Use `import type { ... }` for type-only imports (ESLint `consistent-type-imports`)
- No circular imports (reviewers verify)

### 4.3 React patterns
- Function components; no class components
- Avoid `React.FC`. Use `function Foo(props: FooProps) { ... }` or arrow with explicit param type
- Hooks at top of function body; never in conditionals or loops
- Don't use `useEffect` to derive state from props/store — compute inline or via selectors
- Prefer store selectors over prop drilling once state exists in store

### 4.4 Zustand patterns
- One store per bounded feature: `useRouteStore`, `useAuthStore`
- Actions defined as methods inside the store factory (not separate functions)
- No Immer; use manual object spread for nested updates (models here are shallow)
- Persist only the canonical data, never derived state
- All state mutation from components goes through store actions — components never call `set()` directly

### 4.5 Testing — two layers
- **Unit (per-feature, agent self-verify)**: colocated `*.test.ts(x)`. Target pure logic (state machine, selectors, store actions) and simple component render/interactions. Must run under `jsdom` without real Leaflet, network, or DOM quirks. Must complete in <5s per feature. Every agent runs `pnpm test -- <path-glob>` before reporting DoD.
- **E2E / Visual (QA agent W6)**: Playwright at `src/tests/e2e/` and `src/tests/visual/`. Runs against built app (`pnpm build && pnpm preview`) or dev server. Covers happy path + sad path + 3 visual snapshots.

Agents do not write integration tests that span multiple features during their own workstream — that's W6's job.

### 4.6 data-testid convention
- Every interactive element (buttons, inputs, selectable cards, markers) MUST have `data-testid`
- Format: `<feature>-<element>[-<identifier>]`
- Examples: `auth-login-submit`, `auth-login-operator-id`, `stops-card-<stopId>`, `stops-action-arrive`, `stops-action-depart`, `stops-action-success`, `stops-action-fail`, `stops-failmodal-reason-select`, `stops-failmodal-submit`, `map-marker-<stopId>`, `summary-restart`
- Feature agents (W2–W5) must add testids as they build; W6 relies on them being present

### 4.7 Theme & styling
- Tailwind utility classes only; no inline styles (exception: Leaflet overrides where required)
- Dark mode is the only theme. Base: `bg-slate-900 text-slate-100`
- State colors consumed via `STATE_COLORS` from `@/lib/theme` — no hard-coded state-specific colors
- Responsive breakpoints:
  - Mobile (default): stacked layout (map top 40vh, stop list below, scrollable)
  - `lg:` (≥1024px): two-column (map left 60%, stop list right 40%, both full-height)
- Typography: system font stack via Tailwind default; no custom fonts

### 4.8 Error handling
- State-machine violations: action is a no-op + `console.warn`. UI prevents them via disabled buttons.
- No try/catch in happy path; unexpected errors surface during dev
- No top-level error boundary
- Network errors: N/A (no network)

### 4.9 A11y (baseline)
- Semantic HTML: `<button>` for actions, `<nav>`, `<main>`, `<section>`, `<header>`, `<form>`, `<label>`
- All inputs have associated `<label>`; icon-only buttons have `aria-label`
- Preserve focus rings (no `outline-none` without a replacement)
- State is communicated by text **and** color (never color alone)
- Tab order follows visual order

### 4.10 Git discipline
- Agents do **not** run `git add`, `git commit`, `git push`, or any mutating git op
- User commits explicitly at quality milestones
- If an agent needs git info, it uses read-only: `git status`, `git diff`, `git log`

### 4.11 Communication protocol (agents → main session)
Every subagent report must include:
1. Workstream ID (W0/W1/...)
2. Files created/modified (bullet list)
3. Verification commands run + their results
4. Any blockers encountered
5. Any deviations from the plan (with justification)
6. Whether DoD is met (yes/no)

---

## 5. Architecture & Module Boundaries

```
src/
  app/                           # App shell — OWNED BY W0
    App.tsx                      # Root component (router provider, theme provider)
    routes.tsx                   # Route table (lazy imports all features)
    providers/                   # (reserved, unused for MVP)

  features/
    auth/                        # OWNED BY W2
      LoginPage.tsx
      useAuthStore.ts
      RequireAuth.tsx
      *.test.ts(x)

    route/                       # OWNED BY W1 (+ RouteView created by W0)
      RouteView.tsx              # (W0 stub with layout; composes MapCanvas + StopList)
      useRouteStore.ts           # W1
      routeMachine.ts            # W1 — pure state transitions
      routeSelectors.ts          # W1
      *.test.ts                  # W1

    map/                         # OWNED BY W3
      MapCanvas.tsx
      WaypointMarker.tsx
      RoutePolyline.tsx
      *.test.ts(x)

    stops/                       # OWNED BY W4
      StopList.tsx
      StopCard.tsx
      StopActions.tsx
      FailureReasonModal.tsx
      *.test.ts(x)

    summary/                     # OWNED BY W5
      CompletionSummary.tsx
      *.test.tsx

  lib/                           # OWNED BY W0/W1
    types.ts                     # W1 (additive-only after W1)
    mockData.ts                  # W1
    theme.ts                     # W0 (frozen after W0)
    constants.ts                 # W0 (additive allowed)

  tests/                         # OWNED BY W6
    e2e/                         # Playwright specs
    visual/                      # Playwright visual snapshots

  main.tsx                       # W0 — React entrypoint
  index.css                      # W0 — Tailwind directives
```

**Strict boundary rules:**
- `map/` and `stops/` both import from `features/route/` but **never from each other**
- `auth/` is fully isolated — touches only its own folder + `@/app/routes`
- `lib/types.ts` is **additive-only after W1**. If a workstream needs a domain type beyond what W1 provided, it adds it inside its own feature folder (e.g. `features/stops/stopsTypes.ts`).
- `lib/theme.ts` is **frozen after W0**. New color tokens require re-opening W0, not inline-adding.
- `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.ts`, `eslint`, `playwright.config.ts`, `routes.tsx` — all **W0-owned and frozen** thereafter.

---

## 6. Data Model

All types live in `@/lib/types.ts` and are defined in W1.

**`Location`**: physical point. Fields: `lat` (number), `lng` (number), `address` (string, human-readable), `name` (string, display label like "Pizza Roma" or "123 Main St").

**`Stop`**: one node in the route. Fields: `id` (string), `type` (`'pickup' | 'dropoff'`), `order` (number, 1-indexed position in route), `location` (`Location`), `orderRef` (string — groups pickup with its matching dropoff(s)), `state` (`StopState`), `failureReason` (string, optional — required iff state is `'failed'`), `arrivedAt` (ISO string, optional), `departedAt` (ISO string, optional), `completedAt` (ISO string, optional).

**`Route`**: Fields: `id` (string), `operatorId` (string), `stops` (`Stop[]`), `status` (`RouteStatus`), `assignedAt` (ISO string), `completedAt` (ISO string, optional).

**Enums:**
- `StopType = 'pickup' | 'dropoff'`
- `StopState = 'pending' | 'arrived' | 'departed' | 'success' | 'failed'`
- `RouteStatus = 'assigned' | 'in_progress' | 'complete'`

**Derived values (selectors only, not stored):**
- Route status auto-derives: all stops terminal (`success`/`failed`) → `complete`; any stop past `pending` → `in_progress`; else `assigned`
- Active stop = first stop whose state is not terminal, respecting order

---

## 7. State Machine

Lives in `@/features/route/routeMachine.ts` (W1).

**Valid transitions per stop:**
- `pending → arrived` (action: `arrive`)
- `arrived → departed` (action: `depart`)
- `departed → success` (action: `succeed`) — terminal
- `departed → failed` (action: `fail`, requires `reason: string`) — terminal

**Rules:**
- Any other transition is invalid — store action must no-op and `console.warn`
- Terminal states never transition further
- `failed` transitions require non-empty `reason`
- Machine functions are pure; take `(stop, action, payload)` and return `Stop | null` (null = invalid)

**Tests (W1):**
- All 4 valid transitions produce correct next state + correct timestamp field populated
- All invalid transitions from each state return null
- `failed` transition without reason returns null
- Timestamps are ISO strings

---

## 8. Routing Map

Declared in `@/app/routes.tsx` by W0 using `createBrowserRouter` + lazy imports.

| Path | Component | Guard | Owner of component |
|---|---|---|---|
| `/` | Redirect to `/route` | — | W0 |
| `/login` | `LoginPage` | none | W2 |
| `/route` | `RouteView` | `RequireAuth` (W2) | W0 (stub) composes W3 + W4 |
| `/route/summary` | `CompletionSummary` | `RequireAuth` | W5 |
| `*` (not found) | Redirect to `/route` | — | W0 |

**Guard flow:**
- `RequireAuth` (from W2) wraps protected routes
- If user navigates to `/route` without auth → redirect to `/login`
- On successful login → redirect to `/route`
- When route status becomes `complete` (detected in `RouteView`) → `navigate('/route/summary')`
- "Start new route" (in `CompletionSummary`) → `reset()` store → `navigate('/route')`

---

## 9. Mock Data Contract

Created in `@/lib/mockData.ts` (W1). Exports a single `mockRoute: Route`.

**Composition:**
- Exactly **5 stops** in a single route
- **2 pickups** (distinct restaurants)
- **3 dropoffs** (distinct residential addresses)
- Geography: San Francisco SoMA/Mission area (well-covered by OSM, widely recognizable). Coordinates must be real points in that area. Specific points are the agent's choice as long as they cluster within ~2km to keep the map readable.
- Interleaved order sequence (pickup → dropoff → dropoff → pickup → dropoff) to show a real route pattern

**Order-ref linkage:**
- Pickup 1 has orderRef `"R1"` — dropoffs 1 and 2 also have orderRef `"R1"` (2 orders from restaurant 1)
- Pickup 2 has orderRef `"R2"` — dropoff 3 has orderRef `"R2"` (1 order from restaurant 2)

**Initial state:**
- All stops `state: 'pending'`, no timestamps populated
- Route `status: 'assigned'`, `operatorId: 'op-001'`, `assignedAt: now`

**`reset()` behavior:** produces a new mockRoute with same composition but fresh `assignedAt` and fresh stop IDs (so E2E tests can run repeatedly).

---

## 10. Store API Contract (W1 — FROZEN AFTER W1)

### `useRouteStore`

**State shape:**
- `route: Route`
- `selectedStopId: string | null`

**Actions:**
- `arrive(stopId: string): void`
- `depart(stopId: string): void`
- `succeed(stopId: string): void`
- `fail(stopId: string, reason: string): void`
- `selectStop(stopId: string | null): void`
- `reset(): void`

Each mutation action internally calls `routeMachine` to validate. Invalid → no-op + warn.

**Persist:** key `drone-route-v1`. Persists both `route` and `selectedStopId`.

**Selectors exposed (`@/features/route/routeSelectors.ts`):**
- `selectActiveStop(state): Stop | null`
- `selectRouteStatus(state): RouteStatus` (derived)
- `selectCompletionPercent(state): number` (0–100)
- `selectStopById(state, id): Stop | undefined`

### `useAuthStore` (W2)

**State shape:**
- `isAuthenticated: boolean`
- `operator: { id: string; name: string } | null`

**Actions:**
- `login(id: string, pin: string): void` — any non-empty `id` and `pin` passes (mock). Sets operator = `{ id, name: id }`.
- `logout(): void`

**Persist:** key `drone-auth-v1`.

---

## 11. Theme Contract (W0 — FROZEN AFTER W0)

`@/lib/theme.ts` exports:

- `STATE_COLORS: Record<StopState, { bg: string; text: string; border: string; hex: string }>`
  - `pending`: slate (bg `bg-slate-700`, text `text-slate-200`, border `border-slate-500`, hex `#64748b` for Leaflet)
  - `arrived`: blue (bg `bg-blue-700`, text `text-blue-50`, border `border-blue-400`, hex `#3b82f6`)
  - `departed`: amber (bg `bg-amber-600`, text `text-amber-50`, border `border-amber-400`, hex `#f59e0b`)
  - `success`: emerald (bg `bg-emerald-700`, text `text-emerald-50`, border `border-emerald-400`, hex `#10b981`)
  - `failed`: rose (bg `bg-rose-700`, text `text-rose-50`, border `border-rose-400`, hex `#f43f5e`)

- `FAILURE_REASONS: readonly string[]` — `["Customer not home", "Address not accessible", "Weather / safety", "Package issue", "Other"]`

- Tailwind class helper: `stateClasses(state: StopState): string` returning combined `bg + text + border` utilities.

Note: `hex` values are used by Leaflet (which doesn't understand Tailwind classes). Everything else uses the class variants.

---

## 12. Workstream Breakdown

Each workstream definition below is what you hand to the corresponding subagent.

---

### W0 — Scaffold & Foundations (sequential, first)

**Scope:** Everything that must exist before any other work can start.

**Specific responsibilities:**
1. `pnpm create vite` → React + TS template, into current directory
2. Install all deps from §3's pre-install list
3. Configure TypeScript strict mode; add path alias `@/*` → `src/*` in both `tsconfig.json` and `vite.config.ts`
4. Configure TailwindCSS with dark mode always on (no toggle). Global base styles in `src/index.css`.
5. Configure ESLint: TypeScript parser, React + React-hooks plugins, Prettier integration, consistent-type-imports, import-order
6. Configure Prettier (2-space indent, single quotes, trailing comma, 100 width)
7. Configure Vitest: jsdom env, setup file importing `@testing-library/jest-dom/vitest`, alias matching
8. Configure Playwright: `playwright.config.ts` with baseURL `http://localhost:5173`, chromium project, snapshot dir `src/tests/visual/__snapshots__`
9. Create folder skeleton (per §5) — empty folders are acceptable; feature stubs not required except `features/route/RouteView.tsx`
10. Create `src/app/App.tsx` (router provider + outer shell with `bg-slate-900 text-slate-100`)
11. Create `src/app/routes.tsx` with full route table (§8) using lazy imports referencing files that will be created by later workstreams
12. Create `src/main.tsx` + `src/index.css`
13. Create `src/lib/theme.ts` per §11
14. Create `src/lib/constants.ts` (empty or minimal, but exists for future additive use)
15. Create `src/features/route/RouteView.tsx` — composition page:
    - Responsive layout: stacked (mobile) / two-column (`lg:`)
    - Imports `<MapCanvas />` from `@/features/map` and `<StopList />` from `@/features/stops` (these files will be created by W3/W4 — imports are placeholder for now; to avoid breaking the build in the W0 smoke test, W0 creates empty placeholder component stubs in `features/map/MapCanvas.tsx` and `features/stops/StopList.tsx` that just render `null`. W3/W4 will overwrite these files.)
    - `useEffect` watching `selectRouteStatus` — when `'complete'`, navigate to `/route/summary`
16. Create `src/features/summary/CompletionSummary.tsx` stub (empty component rendering `null`) so lazy import works. W5 overwrites.
17. Create `src/features/auth/LoginPage.tsx` + `src/features/auth/RequireAuth.tsx` stubs (empty; RequireAuth stub simply renders children). W2 overwrites.
18. `package.json` scripts: `dev`, `build`, `preview`, `typecheck` (`tsc --noEmit`), `test` (vitest run), `test:watch`, `test:e2e` (playwright test), `lint` (eslint .), `format` (prettier --write .), `format:check`
19. Write **`README.md`** with: project description, prerequisites (Node ≥ 20, pnpm), install steps, all commands with one-line descriptions, architecture summary (link to `PLAN.md`), testing notes
20. Overwrite project-level **`CLAUDE.md`**, replacing all `[placeholder]` content with the locked decisions from this plan (see §16 for required content)
21. Copy this plan file to repo root as **`PLAN.md`** (committed, long-lived version)
22. Copy `testRules.md` is already there — leave untouched
23. Add `.gitignore` (node_modules, dist, coverage, .env*, .DS_Store, playwright-report, test-results)
24. Run `pnpm typecheck && pnpm lint && pnpm build` — all must pass

**Files owned (exclusive write, frozen after W0):**
- Root: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `.eslintrc.cjs`, `.prettierrc`, `.gitignore`, `playwright.config.ts`, `index.html`, `README.md`, `PLAN.md`, `CLAUDE.md`
- `src/main.tsx`, `src/index.css`
- `src/app/App.tsx`, `src/app/routes.tsx`
- `src/lib/theme.ts`, `src/lib/constants.ts`
- `src/features/route/RouteView.tsx`

**Stub files (W0 creates empty; later workstreams overwrite):**
- `src/features/map/MapCanvas.tsx`, `src/features/map/WaypointMarker.tsx`, `src/features/map/RoutePolyline.tsx`
- `src/features/stops/StopList.tsx`, `src/features/stops/StopCard.tsx`, `src/features/stops/StopActions.tsx`, `src/features/stops/FailureReasonModal.tsx`
- `src/features/auth/LoginPage.tsx`, `src/features/auth/RequireAuth.tsx`, `src/features/auth/useAuthStore.ts`
- `src/features/summary/CompletionSummary.tsx`

**Inputs:** none

**Outputs (contract):** runnable dev server showing empty shell; all commands green; route tree fully wired; theme tokens available

**Definition of Done:**
- [ ] `pnpm install` completes without errors
- [ ] `pnpm typecheck` → 0 errors
- [ ] `pnpm lint` → 0 errors / 0 warnings on all files
- [ ] `pnpm build` → succeeds
- [ ] `pnpm dev` serves localhost:5173 with dark empty shell rendered
- [ ] `README.md`, `PLAN.md`, `CLAUDE.md` present at repo root with real content
- [ ] All stub files exist and are importable (no broken imports)
- [ ] `.gitignore` excludes all non-source artifacts

**Report format:** file list + command outputs + DoD checklist.

---

### W1 — Core Data & Store (sequential, after W0)

**Scope:** Every type, the mock route, the store, the state machine, and their unit tests.

**Specific responsibilities:**
1. Define all types in `src/lib/types.ts` per §6
2. Write `src/lib/mockData.ts` with `mockRoute` per §9 — ensure realistic SF SoMA coordinates, interleaved order (pickup → dropoff → dropoff → pickup → dropoff), correct `orderRef` linkage
3. Write `src/features/route/routeMachine.ts` — pure functions per §7, fully unit-tested
4. Write `src/features/route/routeSelectors.ts` — derived selectors per §10
5. Write `src/features/route/useRouteStore.ts` — Zustand store with persist per §10. Actions internally validate via routeMachine; invalid transitions no-op + warn. Store persists with key `drone-route-v1`. On first load without persisted state, seeds with `mockRoute`.
6. Colocated unit tests:
   - `routeMachine.test.ts` — all valid transitions, all invalid from each state, missing reason on fail
   - `useRouteStore.test.ts` — each action mutates store correctly; invalid transitions don't mutate; `reset()` replaces route with fresh mockRoute (different IDs, reset timestamps); `selectStop` updates selectedStopId
   - `routeSelectors.test.ts` — selector correctness across a few route states
7. Run `pnpm test -- src/features/route src/lib` → all green
8. Run `pnpm typecheck` → 0 errors
9. Run `pnpm lint -- src/features/route src/lib` → clean

**Files owned:**
- `src/lib/types.ts` (additive-only after W1)
- `src/lib/mockData.ts`
- `src/features/route/useRouteStore.ts`
- `src/features/route/routeMachine.ts`
- `src/features/route/routeSelectors.ts`
- `src/features/route/*.test.ts`

**Inputs:**
- `@/lib/theme.ts` (read-only — reference for state color naming consistency, not required at runtime)

**Outputs (contract):** The §10 Store API is now implementable by consumers. No function signatures change after this point.

**Definition of Done:**
- [ ] All types exported from `@/lib/types` per §6
- [ ] `mockRoute` exported from `@/lib/mockData` with 5 stops, correct composition
- [ ] `useRouteStore`, selectors, and machine implemented per §10 & §7
- [ ] Unit tests: routeMachine (≥ 10 tests), store (≥ 8 tests), selectors (≥ 4 tests) — all green
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint -- <W1 paths>` clean
- [ ] `RouteView` (from W0) still renders (no broken imports) — smoke: `pnpm dev` and load `/route`

**Report format:** file list + test output summary + DoD checklist.

---

### W2 — Auth (parallel after W1)

**Scope:** Simulated operator login — form, store, route guard.

**Specific responsibilities:**
1. `src/features/auth/useAuthStore.ts` per §10 (login/logout, persist as `drone-auth-v1`)
2. `src/features/auth/LoginPage.tsx`:
   - Form with two inputs: Operator ID, PIN
   - Both required (non-empty)
   - Submit button (disabled when fields empty)
   - On submit: `useAuthStore.getState().login(id, pin)`, then navigate to `/route`
   - Full dark-theme styling, responsive, matches overall aesthetic
   - data-testids: `auth-login-operator-id`, `auth-login-pin`, `auth-login-submit`
   - If already authenticated (e.g. reload while logged in), redirect to `/route`
3. `src/features/auth/RequireAuth.tsx`:
   - If `!isAuthenticated` → `<Navigate to="/login" replace />`
   - Else → render children
4. Colocated unit tests:
   - `useAuthStore.test.ts` — login sets isAuthenticated + operator; logout clears both
   - `LoginPage.test.tsx` — renders; submit disabled when empty; submit calls login; navigates
   - `RequireAuth.test.tsx` — redirects when not authenticated; renders children when authenticated

**Files owned:**
- `src/features/auth/LoginPage.tsx` (overwrites W0 stub)
- `src/features/auth/RequireAuth.tsx` (overwrites W0 stub)
- `src/features/auth/useAuthStore.ts` (overwrites W0 stub)
- `src/features/auth/*.test.ts(x)`

**Inputs:**
- React Router `useNavigate`, `Navigate`
- Zustand + persist

**Outputs (contract):**
- `<LoginPage />`, `<RequireAuth>`, `useAuthStore` all match §10 signatures

**Definition of Done:**
- [ ] `pnpm test -- src/features/auth` → all green
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint -- src/features/auth` clean
- [ ] Manual smoke (optional): `pnpm dev` → `/login` renders, form works
- [ ] data-testids per §4.6 present

---

### W3 — Map (parallel after W1)

**Scope:** Leaflet map rendering stops + polyline + selection sync.

**Specific responsibilities:**
1. `src/features/map/MapCanvas.tsx`:
   - React-leaflet `<MapContainer>` centered on the bounding box of route stops
   - Tile layer: OpenStreetMap (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`)
   - Renders a `<WaypointMarker>` per stop and a single `<RoutePolyline>` for the ordered path
   - Subscribes to `useRouteStore` for `route.stops` and `selectedStopId`
   - On `selectedStopId` change: pans/flies the map to that stop's location
   - Dark map styling hint: add a CSS filter (`filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(1.1)`) applied to `.leaflet-tile-pane` via index.css or a scoped class (standard OSM-dark hack); ensures readability against slate background
   - data-testid: `map-container`
2. `src/features/map/WaypointMarker.tsx`:
   - Leaflet `divIcon` with numbered badge (stop.order) and color from `STATE_COLORS[stop.state].hex`
   - Pickup shape: rounded square; Dropoff shape: circle (visual differentiation)
   - On click: `useRouteStore.getState().selectStop(stop.id)`
   - data-testid: `map-marker-<stopId>`
3. `src/features/map/RoutePolyline.tsx`:
   - React-leaflet `<Polyline>` connecting stops in `order`
   - Color: neutral (`#94a3b8`), weight 3, opacity 0.7
4. Colocated unit tests (logic only — Leaflet rendering is skipped in jsdom):
   - Helper test: `getMarkerColor(state)` returns correct hex per `STATE_COLORS`
   - Helper test: polyline coordinates are extracted in `order` sequence
   - Extract these helpers as pure functions for testability

**Files owned:**
- `src/features/map/MapCanvas.tsx` (overwrites W0 stub)
- `src/features/map/WaypointMarker.tsx` (overwrites W0 stub)
- `src/features/map/RoutePolyline.tsx` (overwrites W0 stub)
- `src/features/map/*.test.ts(x)`

**Inputs:**
- `@/lib/types`
- `@/features/route/useRouteStore`
- `@/lib/theme` (`STATE_COLORS`)
- `leaflet`, `react-leaflet`

**Outputs (contract):**
- `<MapCanvas />` renders self-contained (no props). Consumed by `RouteView` (already imported in W0 stub — W3 just overwrites the stub file).

**Definition of Done:**
- [ ] `pnpm test -- src/features/map` → all green (logic tests)
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint -- src/features/map` clean
- [ ] Manual smoke: `pnpm dev` → map renders centered on SF with 5 markers + polyline; clicking marker updates store selectedStopId

---

### W4 — Stops UI (parallel after W1)

**Scope:** Stop list, individual stop cards, action buttons, failure reason modal.

**Specific responsibilities:**
1. `src/features/stops/StopList.tsx`:
   - Ordered vertical list of `<StopCard>`s, scrollable
   - On `selectedStopId` change: scroll that card into view (`scrollIntoView({ behavior: 'smooth', block: 'center' })`)
   - data-testid: `stops-list`
2. `src/features/stops/StopCard.tsx`:
   - Shows: order number badge, type icon/label (pickup/dropoff), location name, address, current state badge (using `stateClasses`)
   - Highlighted when `stop.id === selectedStopId` (ring)
   - On click: `selectStop(stop.id)`
   - Renders `<StopActions stop={stop} />`
   - Shows timestamps (arrived/departed/completed) when present
   - If `state === 'failed'`, show `failureReason`
   - data-testid: `stops-card-<stopId>`
3. `src/features/stops/StopActions.tsx`:
   - Buttons: Arrive / Depart / Success / Fail — each enabled only when the state machine allows that transition for `stop.state`
   - Success and Fail only available from `departed`
   - Arrive only from `pending`; Depart only from `arrived`
   - Disabled state visible (grayed out, `disabled` attr)
   - Fail button opens `<FailureReasonModal>`
   - Other buttons call the corresponding store action directly
   - data-testids: `stops-action-arrive|depart|success|fail`
4. `src/features/stops/FailureReasonModal.tsx`:
   - Controlled open/close via local state in StopActions
   - Dropdown of `FAILURE_REASONS` from theme.ts, with "Other" enabling a free-text input
   - Submit button (disabled if reason empty, or "Other" selected with empty text)
   - On submit: call `fail(stop.id, reason)`, close modal
   - Cancel button
   - Trap focus inside modal, close on Escape
   - data-testids: `stops-failmodal`, `stops-failmodal-reason-select`, `stops-failmodal-other-input`, `stops-failmodal-submit`, `stops-failmodal-cancel`
5. Colocated unit tests:
   - `StopCard.test.tsx` — renders correct state badge per state, shows timestamps, shows failure reason when failed
   - `StopActions.test.tsx` — buttons enabled/disabled per state matrix; clicking calls correct store action
   - `FailureReasonModal.test.tsx` — dropdown lists all reasons; "Other" shows text input; submit disabled until valid; submit calls `fail`

**Files owned:**
- `src/features/stops/StopList.tsx` (overwrites W0 stub)
- `src/features/stops/StopCard.tsx` (overwrites W0 stub)
- `src/features/stops/StopActions.tsx` (overwrites W0 stub)
- `src/features/stops/FailureReasonModal.tsx` (overwrites W0 stub)
- `src/features/stops/*.test.tsx`

**Inputs:**
- `@/lib/types`
- `@/features/route/useRouteStore`
- `@/lib/theme` (`STATE_COLORS`, `FAILURE_REASONS`, `stateClasses`)

**Outputs (contract):**
- `<StopList />` renders self-contained (consumed by `RouteView`)

**Definition of Done:**
- [ ] `pnpm test -- src/features/stops` → all green
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint -- src/features/stops` clean
- [ ] Manual smoke: `pnpm dev` → stop list shows 5 stops, can arrive/depart/succeed first stop; modal works on fail
- [ ] data-testids per §4.6 present

---

### W5 — Summary (parallel after W1)

**Scope:** Route completion screen.

**Specific responsibilities:**
1. `src/features/summary/CompletionSummary.tsx`:
   - Reads `route` from `useRouteStore`
   - If `route.status !== 'complete'` → redirect to `/route` (guard against deep-linking)
   - Renders:
     - Heading: "Route Complete" + operator ID
     - Stats row: total stops, success count, failure count, total duration (first arrivedAt → last completedAt)
     - Per-stop breakdown table/list: order, type, name, address, final state badge, arrivedAt, departedAt, duration (departedAt - arrivedAt), failureReason if applicable
   - "Start new route" button: calls `reset()` then navigates to `/route`
   - data-testids: `summary`, `summary-stats-success-count`, `summary-stats-fail-count`, `summary-restart`
2. Colocated unit test:
   - `CompletionSummary.test.tsx` — renders stats correctly for a fully-completed route (fixture with mix of successes and one failure); restart button calls reset

**Files owned:**
- `src/features/summary/CompletionSummary.tsx` (overwrites W0 stub)
- `src/features/summary/*.test.tsx`

**Inputs:**
- `@/lib/types`
- `@/features/route/useRouteStore`
- `@/lib/theme`

**Outputs (contract):** `<CompletionSummary />` renders self-contained

**Definition of Done:**
- [ ] `pnpm test -- src/features/summary` → all green
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint -- src/features/summary` clean
- [ ] Guard redirect works when route not complete
- [ ] data-testids per §4.6 present

---

### W6 — QA: E2E + Visual (sequential, after W2/W3/W4/W5)

**Scope:** End-to-end behavior verification via Playwright.

**Specific responsibilities:**
1. Verify `playwright.config.ts` (from W0) is correct for local dev: baseURL, webServer (auto-start `pnpm dev`), chromium project only
2. `src/tests/e2e/happy-path.spec.ts`:
   - Navigate to `/login`
   - Fill operator-id + pin → submit → redirect to `/route`
   - For each stop in order (1..5):
     - Assert stop card state is `pending`
     - Click `stops-action-arrive` → card state becomes `arrived`
     - Click `stops-action-depart` → `departed`
     - Click `stops-action-success` → `success`
   - Assert navigation to `/route/summary`
   - Assert success count = 5, failure count = 0
3. `src/tests/e2e/sad-path.spec.ts`:
   - Login, click through first stop to `departed`, then click Fail → modal opens
   - Select "Weather / safety" → submit → card shows failed + reason
   - Continue through remaining stops with successes
   - Summary shows success count = 4, failure count = 1, failure reason rendered
4. `src/tests/visual/screens.spec.ts`:
   - Login page snapshot
   - Active route view (mid-flow: first stop succeeded, second arrived, rest pending) snapshot
   - Summary page snapshot (mix of results)
   - Set viewport to 1280x800 for all snapshots to make diffs reliable
5. Additional scripts in `package.json` (W6 may add, coordinate with W0):
   - `test:all` → runs `pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`

**Files owned:**
- `src/tests/e2e/*.spec.ts`
- `src/tests/visual/*.spec.ts`
- `src/tests/visual/__snapshots__/*` (baseline images generated)
- Possibly `playwright.config.ts` adjustments (if strictly needed — prefer to flag rather than change)
- Possibly `package.json` scripts addition (flag to user)

**Inputs:** Running integrated app (all features complete)

**Outputs:** Green E2E suite + baseline visual snapshots

**Definition of Done:**
- [ ] `pnpm test:e2e` → all green (headless)
- [ ] Visual snapshots generated and committed
- [ ] `test:all` script passes end-to-end
- [ ] No flaky selectors — only data-testid-based queries

---

## 13. Parallelization Timeline

```
t0: W0 (single agent)                     [ sequential, required foundation     ]
t1: W1 (single agent)                     [ sequential, depends on W0            ]
t2: W2 + W3 + W4 + W5 (4 agents, dispatched in one message, parallel)
t3: Integration smoke by main session     [ pnpm dev, manual click-through       ]
t4: W6 (single agent)                     [ sequential, depends on t3 success    ]
t5: Final verification (main session)     [ full verification matrix             ]
```

- Agent dispatch happens via a single message with 4 Agent calls at t2
- Each parallel agent MUST NOT touch files outside its owned folder (per §5 boundaries)
- Main session waits for all 4 to report DoD before advancing to t3

---

## 14. Blockers & Mitigations

| # | Blocker | Mitigation |
|---|---|---|
| 1 | Parallel agents conflict on shared files (`package.json`, `routes.tsx`, `tailwind.config.ts`, `theme.ts`, `types.ts`) | W0 + W1 pre-define these; they are frozen for parallel phase. Agents creating new deps or types must halt and escalate. |
| 2 | Import errors from incomplete sibling features during W2–W5 | W0 creates empty stubs at every feature path referenced by `routes.tsx` or `RouteView.tsx`. Parallel agents overwrite their stubs. Build and unit tests of any single agent's scope still pass because stubs are valid empty components. |
| 3 | `lib/types.ts` needs a type not in W1's output | Agent adds type to its own feature folder (e.g., `features/stops/stopsTypes.ts`). Does not edit `lib/types.ts`. |
| 4 | Store API needs a new action during W3/W4/W5 | Halt and escalate to main session. Do not add store actions ad-hoc. |
| 5 | Leaflet won't render under jsdom (unit tests) | W3's unit tests target pure helper functions (color mapping, coordinate extraction). Full map render is W6's job via Playwright. |
| 6 | Map tile CSS dark-mode hack conflicts with Leaflet's own styles | W3 applies filter via a scoped class on `.leaflet-tile-pane` inside MapCanvas — tested in the visual snapshot. |
| 7 | Zustand persist rehydration creates stale mockRoute on reset during dev | `reset()` generates a fresh mockRoute with new IDs; persist middleware overwrites localStorage on write. |
| 8 | E2E tests are flaky because of Playwright-Leaflet timing | Rely on `data-testid` only (never text/positional). Wait for map container present + first marker with testid before interacting. |
| 9 | Subagent reports DoD but has lint warnings or type errors | DoD checklist requires explicit green output from `pnpm typecheck` and `pnpm lint -- <scope>`. Main session verifies before proceeding. |
| 10 | pnpm not installed on system | W0 agent first verifies `pnpm --version`; if missing, halts with clear error. User installs pnpm. |
| 11 | Agent runs `pnpm install` concurrently causing lockfile contention | Only W0 runs `pnpm install`. Parallel agents only run `pnpm test`, `pnpm typecheck`, `pnpm lint` — all read-only on node_modules. |
| 12 | Agent accidentally edits outside its folder | Main session spot-checks `git diff` per workstream report before accepting DoD. |
| 13 | Agents introduce new deps silently | Forbidden per §3; any needed dep must be escalated and added in W0 re-open. |

---

## 15. Verification Matrix

Run at end of implementation (before user commits the "done" milestone):

| Check | Command | Pass criterion |
|---|---|---|
| Types | `pnpm typecheck` | 0 errors |
| Lint | `pnpm lint` | 0 errors, 0 warnings |
| Unit tests | `pnpm test` | All green, coverage of routeMachine + store + selectors + core components |
| Build | `pnpm build` | Succeeds, outputs to `dist/` |
| E2E | `pnpm test:e2e` | Happy + sad path pass |
| Visual | `pnpm test:e2e` (visual project) | Snapshots match baseline |
| Manual smoke | `pnpm dev` | Full flow: login → click through → complete → summary → restart |

---

## 16. Post-plan tasks — CLAUDE.md & README.md content

### `CLAUDE.md` (project root) — W0 writes with this content (replacing placeholders):

```
# Project: Drone Delivery Ops

## Stack
- React 18 + Vite + TypeScript (strict)
- TailwindCSS (dark mode only)
- Zustand (per-feature stores with persist)
- React Router v6
- Leaflet + react-leaflet (OSM tiles)
- Vitest + React Testing Library (unit)
- Playwright (E2E + visual)
- Package manager: pnpm

## Commands
- Install:    pnpm install
- Dev:        pnpm dev
- Typecheck:  pnpm typecheck
- Test:       pnpm test
- Test E2E:   pnpm test:e2e
- Lint:       pnpm lint
- Format:     pnpm format
- Build:      pnpm build

## Tool preferences
- Use `context7` for any library API question before writing code. Version-pin when possible.
- Use ripgrep for search, never `grep -r`.
- Prefer editing existing files over creating new ones.
- Never add comments unless explicitly asked.

## Architecture rules
- Feature-based: `src/features/{auth,route,map,stops,summary}`
- Cross-feature rule: `map/` and `stops/` read from `route/` but NEVER import from each other
- Types in `src/lib/types.ts` — frozen after W1, additive only in feature folders thereafter
- Theme in `src/lib/theme.ts` — frozen after W0
- Test files colocated as `*.test.ts(x)` next to source; E2E in `src/tests/e2e/`
- Named exports only (no default exports)
- One Zustand store per feature; mutations only via store actions
- data-testid on every interactive element: `<feature>-<element>[-<id>]`
- All state colors from `STATE_COLORS` in `@/lib/theme` — no raw hex in components

## Verification loop (mandatory before declaring done)
1. pnpm typecheck → 0 errors
2. pnpm test → all green
3. pnpm lint → 0 warnings on changed files
4. pnpm build → succeeds
5. pnpm test:e2e → all green
6. For UI changes: Playwright visual snapshot up-to-date
7. Summarize what changed, what was verified, what was NOT verified

## Workflow
1. Read PLAN.md end-to-end before any work.
2. Any deviation from PLAN.md requires explicit plan update.
3. Respect workstream boundaries (see PLAN.md §5 & §12).
4. Agents do not run git commands that mutate state.
5. User commits at milestones; agents never commit.

## Mistakes to avoid
- Do not touch `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.ts`, `routes.tsx`, `theme.ts` after their owner workstream completes.
- Do not add dependencies; escalate if needed.
- Do not use default exports.
- Do not import across feature boundaries (`map/` ↔ `stops/` forbidden).
```

### `README.md` (project root) — W0 writes:

- Project description (1 paragraph)
- Prerequisites (Node 20+, pnpm)
- Install: `pnpm install`
- Run dev: `pnpm dev` → http://localhost:5173
- Commands table (every pnpm script + one-line description)
- Project structure summary (link to `PLAN.md` for full detail)
- Testing notes: how to run unit + E2E + visual
- Mock credentials reminder (any non-empty id + pin works)

---

## 17. Deliverable Inventory

### Created by W0
Root: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `.eslintrc.cjs`, `.prettierrc`, `.gitignore`, `playwright.config.ts`, `index.html`, `README.md`, `PLAN.md`, `CLAUDE.md`
Src: `main.tsx`, `index.css`, `app/App.tsx`, `app/routes.tsx`, `lib/theme.ts`, `lib/constants.ts`, `features/route/RouteView.tsx`, stubs for map/stops/auth/summary

### Created by W1
`lib/types.ts`, `lib/mockData.ts`, `features/route/{useRouteStore,routeMachine,routeSelectors}.ts` + tests

### Created by W2
`features/auth/{LoginPage,RequireAuth,useAuthStore}.tsx?` + tests

### Created by W3
`features/map/{MapCanvas,WaypointMarker,RoutePolyline}.tsx` + tests

### Created by W4
`features/stops/{StopList,StopCard,StopActions,FailureReasonModal}.tsx` + tests

### Created by W5
`features/summary/CompletionSummary.tsx` + test

### Created by W6
`src/tests/e2e/{happy-path,sad-path}.spec.ts`, `src/tests/visual/screens.spec.ts`, visual snapshots

---

## 18. Open Questions

**None — design locked.** Any future question becomes a Blocker (§14) and requires halting the current workstream.

---

## Appendix A — Agent Orchestration Protocol (for main session use)

When dispatching subagents:

1. **Single workstream, sequential** (W0, W1, W6): one Agent call, wait for report, verify DoD, advance
2. **Parallel batch** (W2+W3+W4+W5 at t2): one message containing 4 Agent tool calls; main session resumes only when all 4 complete
3. Every dispatch prompt **must** include:
   - Workstream ID and full scope from §12
   - Link reference: "Read `PLAN.md` §12 (W#) for the full spec"
   - Reminder of standards §4 and boundary rules §5
   - Required report format from §4.11
4. Main session rejects a DoD report if any checklist item is missing; requests re-run with specific gap
5. Between parallel phase (t2) and W6 (t4), main session runs **integration smoke** — `pnpm dev`, manually walk the golden path. Fix any integration bugs via a targeted follow-up agent dispatch before entering W6.
