# Freguês

Loyalty card PWA for salons and barbershops. Tagline: "Quem volta, ganha."

Read `CLAUDE.md` and `docs/` before working. The rules live in `docs/BUSINESS_RULES.md`.

## Layout

| Path              | What                                          |
| ----------------- | --------------------------------------------- |
| `apps/api`        | REST API (NestJS, from milestone M0)          |
| `apps/web`        | PWA (React + Vite, from T02)                  |
| `packages/shared` | Shared types, Zod schemas and constants       |
| `docs/`           | Product, rules, data model, API and decisions |

## Setup

Requires Node 22+ and pnpm 10.

```bash
pnpm install
cp .env.example .env
docker compose up -d   # Postgres 16 on localhost:5432
```

## Scripts

| Command          | What                            |
| ---------------- | ------------------------------- |
| `pnpm dev`       | Run every app in dev mode       |
| `pnpm build`     | Build every package             |
| `pnpm test`      | Run Vitest in every package     |
| `pnpm lint`      | ESLint and Prettier check       |
| `pnpm format`    | Format with Prettier            |
| `pnpm typecheck` | `tsc --noEmit` in every package |

`pnpm db:migrate` and `pnpm db:seed` arrive with T18 and T20.

## API

`pnpm --filter @fregues/api dev` starts the API on http://localhost:3000 (change it with `PORT`).
`GET /health` tells that it is up and `GET /docs` shows the OpenAPI page. Errors follow
`docs/API.md` sections 1 and 2. Logs never hold personal data (golden rule 8).

## Looking at screens in development

The customer app uses a simulated session until the API exists. In `pnpm dev`, open any
route with `?session=` to jump to a state (it is remembered in the browser):

| URL                                         | State                                            |
| ------------------------------------------- | ------------------------------------------------ |
| `http://localhost:5173/?session=signed-in`  | Signed in, with a name: Home, My QR and Profile. |
| `http://localhost:5173/?session=signed-out` | Signed out: goes to the welcome screen.          |
| `http://localhost:5173/?session=needs-name` | New account, name step pending.                  |

### Signing in (simulated)

There is no SMS yet. When you ask for a code, the app generates a real one, valid for 5 minutes
and for that number only, and prints it in the **browser console** (press F12, tab Console):

```
[OTP simulado] +5511900000000 -> 482913 (vale 5 min, até 14:32:10)
```

This only happens in `pnpm dev`, never in a production build. The rules are the real ones:
the code works once, a new code replaces the previous one, five wrong codes lock the number for
15 minutes, and a number can ask for three codes per hour. The number `(11) 90000-0000` is the
existing account (goes Home). Any other number is a new account (goes to the name step).
The memory of codes and limits lives in the open page: reloading it starts over.
