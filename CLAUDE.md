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
