# Task plan

This file drives development, one task at a time. The workflow is in the `approval-workflow` skill. Main rule: **a task is only "Done" after Tiago approves it.** Claude Code never sets "Done" on its own.

## Statuses

| Status | Meaning |
|---|---|
| Pending | Not started. |
| In progress | Claude Code is working on it. At most **one** task has this status. |
| In review | Finished, with evidence, waiting for Tiago. Claude Code stops and waits. |
| Adjusting | Tiago asked for changes. Claude Code fixes them and returns the task to "In review". |
| Done | Tiago approved. Only then is the branch merged into `main`. |

## Definition of done (applies to every task)

1. `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
2. Screen or component: matches the design file (`.dc.html`) in measures, colors, texts and states. There is a screenshot in `docs/evidence/<task-id>/` and, for components, a Storybook story.
3. Backend: migration, RLS test (when there is a new table) and tests with the rule code in the name (`RN-...`).
4. Accessibility: labels, visible focus, touch target of 44 px or more, state never conveyed by color alone.
5. User-facing text in Brazilian Portuguese, in the messages file. Everything else in English (decision D-007).
6. Documents updated if a rule, contract or decision changed.
7. Delivery message in the format defined by the `approval-workflow` skill.

## Phase A. Foundation and design system

| Id | Task | Deliverable | Status |
|---|---|---|---|
| T01 | Monorepo and tooling | `git init`; pnpm workspaces with `apps/api`, `apps/web`, `packages/shared`; TypeScript `strict`; ESLint and Prettier; Vitest; root scripts (`dev`, `build`, `test`, `lint`, `typecheck`); `docker-compose.yml` with Postgres 16; `.env.example`; GitHub Actions CI; short `README`. Update the "Comandos" section of `CLAUDE.md`. | Done |
| T02 | Web app base | Vite + React + TS; Tailwind v4; shadcn/ui; tokens and type scale from `CLAUDE.md` in `index.css`; local Manrope font; React Router; minimal PWA (manifest and icons from `docs/design/logo/`); Storybook with a 390 x 844 viewport and a "Tokens" page (colors, type, radii). | Done |
| T03 | Design system 1: buttons and icons | `Button`, `IconButton`, `Icon`. Every variant and state in stories. Reference: `Botao`, `BotaoIcone`, `Icone`. | Done |
| T04 | Design system 2: brand | `StampSeal` (normal and inverted), `Logo` (horizontal, and vertical with tagline), `StepDots`. Reference: `Selo`, `Pontos`, `docs/design/logo/`. | Done |
| T05 | Design system 3: fields | `TextField` (prefix, suffix, icon, optional label, states) and `OtpInput`. Reference: `Campo`, `Codigo`. | Done |
| T06 | Design system 4: card | `StampGrid`, `ProgramCard` (light and dark by contrast, complete, `joined`), `QrCard` (QR with `qrcode`, bar and countdown, `role="progressbar"`). Contrast function with a test. Reference: `CartaoFidelidade`, `Meu-QR`, `Inicio-Selecionado`. | Done |
| T07 | Design system 5: navigation and choices | `BottomNav` (customer and owner), `MenuRow`, `RadioCard`, `SegmentedControl`. Reference: `BarraAbas`, `LinhaMenu`, `OpcaoCartao`, `Segmentado`. | Done |

## Phase B. Customer screens, with fixed data

Read the `implement-screen` skill before each screen. Screen numbers are the canvas numbers (`docs/PRD.md`, section 6).

| Id | Task | Screens | Status |
|---|---|---|---|
| T08 | Customer app shell | Phone frame, routes, `fixtures` and data hooks (D-008), simulated route guard. | Done |
| T09 | Welcome | 01.1, 01.2, 01.3 (`OnboardingArt`, `StepDots`, skip). | In review |
| T10 | Profile choice | 02 (sheet with the X in the corner). | Pending |
| T11 | Sign in | 03 (phone) and 04 (SMS code, resend countdown, change number). UI only, with simulated submit. | Pending |
| T12 | First access | 05 (name). | Pending |
| T13 | Home | 06, 06.1, 06.2 (stacked cards, selection, attached QR, simulated 30 s countdown). | Pending |
| T14 | My QR and Profile | 07, 08. | Pending |
| T15 | Sheets and detail | 09, 10, 06.3. | Pending |
| T16 | Business page | 00 (`/s/:slug`). | Pending |

## Phase C. Backend milestones and wiring the screens

Each milestone below is a **block**, not a task. **When it is reached, Claude Code breaks the milestone into small tasks (like the ones above), adds them to this plan and waits for Tiago's OK on the breakdown before starting.** Each screen is wired to the API in its own task, after the matching API is approved.

| Milestone | Content | Screens wired |
|---|---|---|
| M0. Foundation | API base (NestJS, config, logs without personal data, `health`, error format), database roles, base migrations, RLS and isolation tests, `Clock`. | None. |
| M1. Business and cards | Business sign-up, staff login, sessions, create and edit cards, public page. | 00, 19, 20 |
| M2. Customer | SMS OTP, profile, enrollments, `qr-token`. | 03, 04, 05, 06, 06.1, 06.2, 07, 08, 06.3 |
| M3. Counter | Staff invite, scanner, `scan/resolve`, visit, interval, idempotency. | 11 to 15, 17, 09 |
| M4. Prize and expiry | Cycles, expiry, prize, redemption, reversal, scheduled jobs. | 10, 16, 27 |
| M5. Dashboard and management | Owner components, dashboard, customers, customer detail, team, invite, counter QR. | 18 to 26 |
| M6. Billing | Mercado Pago, webhooks, plan states, read-only mode. | 25 |
| M7. Launch | Landing (Astro), Terms and Privacy, LGPD deletion, monitoring, backup, pilot. | Landing |

## Log

One line per status change, newest on top. Format: `YYYY-MM-DD  Txx  status  note`.

2026-10-29  T01  In review  Monorepo, tooling, Docker, CI and README ready; waiting for Tiago.
2026-10-29  T01  In progress  Started on branch task/T01-monorepo-tooling.
2026-10-29  T01  Done  Approved by Tiago; merged into main.
2026-10-29  T02  In progress  Started on branch task/T02-web-base.
2026-10-29  T02  In review  Web base, tokens, PWA and Storybook ready; waiting for Tiago.
2026-10-29  T02  Done  Approved by Tiago; merged into main.
2026-10-29  T03  In progress  Started on branch task/T03-buttons-icons.
2026-10-29  T03  In review  Button, IconButton and Icon ready with stories; waiting for Tiago.
2026-10-30  T03  Adjusting  Tiago asked to build every base component from shadcn; regenerating Button with the CLI.
2026-10-30  T03-T07  In review  Design system delivered as one batch at Tiago's request, every base component generated with the shadcn CLI; waiting for Tiago.
2026-10-30  T03-T07  Done  Approved by Tiago; merged into main.
2026-10-30  T08  In progress  Started on branch task/T08-customer-shell.
2026-10-30  T08  In review  Customer shell, fixtures, hooks and simulated guard ready; waiting for Tiago.
2026-10-30  T08  Done  Approved by Tiago; merged into main.
2026-10-30  T09  In progress  Started on branch task/T09-welcome.
2026-10-30  T09  In review  Welcome screens 01.1 to 01.3 and OnboardingArt ready; waiting for Tiago.
2026-10-31  T09  Adjusting  Tiago asked: dots right above the button, white sheet sized to its content.
2026-10-31  T09  In review  Adjusted: sheet fits its content, dots above the button; waiting for Tiago.
