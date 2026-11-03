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

## Database

```bash
cp .env.example .env
docker compose up -d     # Postgres 16 on localhost:5432
pnpm db:migrate          # applies apps/api/migrations and sets the passwords of the two roles
pnpm db:seed             # sample data of the design: Maria (+55 11 90000-0000) and her 3 cards
pnpm db:codegen          # regenerates the Kysely types after a migration
```

- `app_user` is what requests use and is subject to row level security. `app_system` ignores it
  and is used only inside `apps/api/src/system/`.
- A migration that was applied is never edited: `pnpm db:migrate` refuses a changed file. Add a
  new numbered file instead.
- If port 5432 is already taken by another Postgres, change the left side of `ports` in
  `docker-compose.yml` and the port in the three `DATABASE_URL*` variables of your `.env`.
- Integration tests (`*.int.test.ts`) start their own Postgres with Docker, on a random port.
  `pnpm --filter @fregues/api test:unit` skips them.

## API

`pnpm --filter @fregues/api dev` starts the API on http://localhost:3000 (change it with `PORT`).
`GET /health` tells that it is up and `GET /docs` shows the OpenAPI page. Errors follow
`docs/API.md` sections 1 and 2. Logs never hold personal data (golden rule 8).

### Signing in as a customer (development)

There is no SMS provider yet. With `SMS_PROVIDER=console` (the default in development), asking
for a code prints it in the **terminal where the API runs**:

```
[OTP simulado] +5511900000000 -> 482913 (vale 5 min, até 14:32:10)
```

```bash
curl -X POST http://localhost:3000/v1/customer/auth/otp/request \
  -H "Content-Type: application/json" -d '{"phone":"+5511900000000"}'
```

The code works for 5 minutes and only the last one is valid. A number can ask for 3 codes per
hour, and an IP address for 20. The console sender refuses to run outside development.

Then confirm it. The refresh token comes in a cookie, so keep a cookie jar (`-c`/`-b`):

```bash
curl -c jar.txt -X POST http://localhost:3000/v1/customer/auth/otp/verify \
  -H "Content-Type: application/json" -d '{"phone":"+5511900000000","code":"482913"}'
curl -b jar.txt -c jar.txt -X POST http://localhost:3000/v1/customer/auth/refresh
curl -b jar.txt -c jar.txt -X POST http://localhost:3000/v1/customer/auth/logout
```

The profile needs the access token (`accessToken` of the answer above). A new account has no
name yet; the first access sends the name and the acceptance of the Terms:

```bash
curl http://localhost:3000/v1/customer/me -H "Authorization: Bearer $TOKEN"
curl -X PATCH http://localhost:3000/v1/customer/me -H "Authorization: Bearer $TOKEN"   -H "Content-Type: application/json" -d '{"name":"Carlos Mendes","acceptTerms":true}'
```

Five wrong codes kill the code and lock the number for 15 minutes. Each `refresh` gives a new
refresh token and the old one stops working; showing an old one again ends that whole login.

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
