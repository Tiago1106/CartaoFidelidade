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
| T09 | Welcome | 01.1, 01.2, 01.3 (`OnboardingArt`, `StepDots`, skip). | Done |
| T10 | Profile choice | 02 (sheet with the X in the corner). | Done |
| T11 | Sign in | 03 (phone) and 04 (SMS code, resend countdown, change number). UI only, with simulated submit. | Done |
| T12 | First access | 05 (name). | Done |
| T13 | Home | 06, 06.1, 06.2 (stacked cards, selection, attached QR, simulated 30 s countdown). | Pending |
| T14 | My QR and Profile | 07, 08. | Pending |
| T15 | Sheets and detail | 09, 10, 06.3. | Pending |
| T16 | Business page | 00 (`/s/:slug`). | Pending |

## Phase B2. Customer backend now (breakdown approved by Tiago on 2026-11-01)

Tiago wants to test real behavior together with each screen, so the customer side of the backend (M0 slimmed down and M2) comes **before** T13. Order: T12 stays as delivered (simulated). T17 to T26 build the API with its tests. T27 wires screens 03, 04 and 05 and removes the simulated sign-in. From T13 on, every screen is built already wired to the API (no new `fixtures`). One task at a time, each with Tiago's approval.

| Id | Task | Deliverable | Rules | Status |
|---|---|---|---|---|
| T17 | API base | NestJS app in `apps/api`: env config validated, logs that never hold personal data, `GET /health`, error format and codes of `API.md` sections 1 and 2, Zod validation, OpenAPI, injectable `Clock`. Test per error code. | CLAUDE.md golden rules 6 and 8 | Done |
| T18 | Database base | Roles `app_user` and `app_system`, plain SQL migration runner (`pnpm db:migrate`), `kysely-codegen`, `SET LOCAL` context helper inside a transaction, Testcontainers test harness. | D-001 | Done |
| T19 | Customer and auth tables | Migrations and RLS for `customers`, `otp_codes`, `phone_lockouts`, `sessions`, `sms_messages`. RLS tests (no context returns no rows, foreign `business_id` fails). | RN-AUT, RN-LGP | In review |
| T20 | Business, card and stamp tables | Migrations and RLS for `businesses`, `programs`, `business_customers`, `enrollments`, `cycles`, `stamps` (append-only trigger), `qr_tokens`. Isolation tests between business A and B. Seed (`pnpm db:seed`) with Maria and the three cards of the design. | RN-TEN, RN-CAR-04, golden rules 1 and 2 | Pending |
| T21 | OTP request | SMS provider interface plus a **console provider** (the code is printed in the API log, development only: same temporary exception of D-022, never in production). `POST /v1/customer/auth/otp/request`: +55 only, 3 per hour, 60 s between codes, same answer for new and existing numbers, hashed code. | RN-AUT-01, 02, 03, 05 | Pending |
| T22 | OTP verify and session | `POST .../otp/verify` (5 attempts, 15 min lock, single use, 5 min validity), access JWT (`jose`), opaque refresh in an `HttpOnly` cookie, `refresh` with rotation, `logout`. | RN-AUT-02, RN-ENT-03 | Pending |
| T23 | Customer profile | `GET` and `PATCH /v1/customer/me`: first access sends only `name` and `acceptTerms`, with terms version and date recorded. `email` optional. | RN-ENT-07, 08, RN-LGP-02 | Pending |
| T24 | Enrollments | `GET /v1/customer/enrollments` and `/:id` (progress, validity, prize, history) and `POST .../businesses/:slug/join`. Expiry resolved with the `Clock` (`DATA_MODEL` 10.3). | RN-ENT-02, RN-VAL | Pending |
| T25 | Customer QR token | `POST /v1/customer/qr-token`: 45 s expiry, renewed every 30 s, single use, hashed, only the last one valid. | RN-QR | Pending |
| T26 | Dev environment | One command brings everything up: Postgres, migrations, seed, API and web (`pnpm dev`), web talks to the API (proxy or CORS), `.env.example` updated, README. | CLAUDE.md "Comandos" | Pending |
| T27 | Wire sign-in and first access | Web API client (TanStack Query, access token in memory, silent refresh). Screens 03, 04 and 05 call the real endpoints. The simulated sign-in (`data/auth.ts`, `data/firstAccess.ts`) is deleted. The code is read from the API log. | RN-AUT, RN-ENT-07 | Pending |

After T27, T13 to T16 follow as in Phase B, but each one is **built already wired** to T24 and T25 (the fixtures stop being used). What cannot be tested yet: registering visits, prizes and reversal need M3 and M4. Until then the seed holds the stamps already shown in the design.

## Phase C. Backend milestones and wiring the screens

Each milestone below is a **block**, not a task. **When it is reached, Claude Code breaks the milestone into small tasks (like the ones above), adds them to this plan and waits for Tiago's OK on the breakdown before starting.** Each screen is wired to the API in its own task, after the matching API is approved.

| Milestone | Content | Screens wired |
|---|---|---|
| M0. Foundation (customer part is T17 to T20, see Phase B2) | API base (NestJS, config, logs without personal data, `health`, error format), database roles, base migrations, RLS and isolation tests, `Clock`. | None. |
| M1. Business and cards | Business sign-up, staff login, sessions, create and edit cards, public page. | 00, 19, 20 |
| M2. Customer (T21 to T27 and T13 to T16 wired, see Phase B2) | SMS OTP, profile, enrollments, `qr-token`. | 03, 04, 05, 06, 06.1, 06.2, 07, 08, 06.3 |
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
2026-10-31  T09  Done  Approved by Tiago; merged into main.
2026-10-31  T10  In progress  Started on branch task/T10-profile-choice.
2026-10-31  T10  In review  Profile choice sheet (screen 02) and the Sheet component ready; waiting for Tiago.
2026-10-31  T10  Adjusting  Tiago asked: "Sou do salão" becomes "Sou prestador".
2026-10-31  T10  In review  Adjusted: "Sou prestador"; waiting for Tiago.
2026-10-31  T10  Adjusting  Tiago asked: replace "salão" by "negócio" in the profile hint and in welcome step 2.
2026-10-31  T10  In review  Adjusted: "negócio" instead of "salão" in two texts; waiting for Tiago.
2026-10-31  T10  Done  Approved by Tiago; merged into main.
2026-10-31  T11  In progress  Started on branch task/T11-sign-in.
2026-10-31  T11  In review  Sign-in screens 03 and 04 with simulated OTP ready; waiting for Tiago.
2026-10-31  T11  Adjusting  Tiago asked for adjustments; waiting for the details.
2026-10-31  T11  In review  Adjusted: real OTP generated per number with 5 min validity, printed in the console; waiting for Tiago.
2026-10-31  T11  Done  Approved by Tiago. Squash-merged into main.
2026-10-31  T12  In progress  Started on branch task/T12-first-access.
2026-10-31  T12  In review  First access screen 05 ready; waiting for Tiago.
2026-11-01  T12  Done  Approved by Tiago. Squash-merged into main.
2026-11-01  T17-T27  Approved  Phase B2 breakdown (customer backend before T13) approved by Tiago.
2026-11-01  T17  In progress  Started on branch task/T17-api-base.
2026-11-01  T17  In review  API base ready (NestJS, health, error format, logs, Clock); waiting for Tiago.
2026-11-01  T17  Done  Approved by Tiago. Squash-merged into main.
2026-11-01  T18  In progress  Started on branch task/T18-database-base.
2026-11-01  T18  In review  Database base ready (roles, migrations, tenant context, Testcontainers); waiting for Tiago.
2026-11-01  T18  Done  Approved by Tiago. Squash-merged into main.
2026-11-01  T19  In progress  Started on branch task/T19-customer-auth-tables.
2026-11-01  T19  In review  Customer and auth tables with RLS ready; waiting for Tiago.
