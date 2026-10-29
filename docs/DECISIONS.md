# Technical decisions

Short log of choices that `CLAUDE.md` left open or that changed. One row per decision, with a number, a date and a one-line reason. To change a decision, add a new row that supersedes the old one. Do not delete old rows.

| Id | Date | Decision | Reason |
|---|---|---|---|
| D-001 | 2026-10-29 | Data access with **Kysely** + `kysely-codegen` (types generated from the database). Migrations are **plain numbered SQL files**, run by a small script in `apps/api`. | The data model has a lot of hand-written SQL (RLS, triggers, routines with `FOR UPDATE`, `SET LOCAL`). Kysely keeps the transaction and the RLS context explicit and does not hide the SQL. |
| D-002 | 2026-10-29 | **Tailwind CSS v4** with shadcn/ui. | The starter tokens in `CLAUDE.md` already use `@theme inline`. |
| D-003 | 2026-10-29 | **Storybook** in `apps/web` to build and approve the design system. | Tiago approves each component on a single page, without assembling a screen. |
| D-004 | 2026-10-29 | **Vitest** for unit and integration tests, **Testcontainers** for a real Postgres, **Playwright** for flows and screenshots. | Matches the stack in `CLAUDE.md`. |
| D-005 | 2026-10-29 | Local Postgres via **Docker Compose** (`docker-compose.yml` at the root, Postgres 16). | One command gives everyone the same database. |
| D-006 | 2026-10-29 | shadcn components live in `apps/web/src/components/ui/`. Product composites (`ProgramCard`, `BottomNav`, ...) live in `apps/web/src/components/product/`. | Separates base from product-specific. |
| D-007 | 2026-10-29 | **Everything is in English**: code, identifiers, file and folder names, routes, database objects, commit messages, code comments and documentation filenames. **Only text shown to the end user is Brazilian Portuguese.** That text lives in `apps/web/src/messages/pt-BR.ts` (keys in English), and in the API's message module for errors and e-mails. | Project rule from Tiago. |
| D-008 | 2026-10-29 | Customer screens start with **fixed data** (`fixtures`) behind TanStack Query hooks. Each screen is wired to the API later, in its own task. | Tiago approves the visual early, and swapping in the API does not touch the screens. |
| D-009 | 2026-10-29 | `docs/design/screens/*.dc.html` are **read-only** and act as a specification. Their file names are the original Portuguese names exported from the design tool and stay as they are. Do not try to render them (they depend on a `support.js` that is not in the repository). | Avoids wasted effort and accidental edits to the design source. |
| D-010 | 2026-10-29 | Business rule ids keep the prefix `RN-` (Portuguese for "business rule") because they are identifiers used across the documents. Test names use them, for example `it('RN-VAL-02: expired cycle loses its stamps', ...)`. | Renaming ids would touch every document. Can be changed later with a single search and replace. |
| D-011 | 2026-10-29 | Routes are in English. Customer: `/`, `/my-qr`, `/profile`, `/sign-in`, `/sign-in/code`, `/sign-up`, `/welcome`, `/s/:slug`. Staff: `/staff/...`. Owner: `/owner/...`. | Follows D-007. |
