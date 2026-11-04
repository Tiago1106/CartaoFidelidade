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

Requires Node 22+, pnpm 10 and Docker.

```bash
pnpm install
pnpm start:dev
```

`pnpm start:dev` does everything else: it creates `.env` from `.env.example` when there is none
(and picks a free port for Postgres if 5432 is taken), starts Postgres in Docker, applies the
migrations, loads the sample data and runs the API (http://localhost:3000) and the web app
(http://localhost:5173). It is safe to run again. Stop it with Ctrl+C; the data stays in the
Docker volume `fregues_pgdata`.

The web app asks `/v1/...` of its own address and Vite forwards it to the API (see
`apps/web/vite.config.ts`), so there is no CORS to set up and the refresh cookie belongs to the
same origin as the app.

The code of the SMS is printed in the terminal, in a line that starts with `[OTP simulado]`.
Asking for codes over and over reaches the real limits (3 per hour per number); `pnpm db:unlock`
clears the codes and the locks of your development database so you can start again.

## Scripts

| Command          | What                                                                       |
| ---------------- | -------------------------------------------------------------------------- |
| `pnpm start:dev` | Everything for development: Postgres, migrations, sample data, API and web |
| `pnpm dev`       | Run every app in dev mode (the database must be up)                        |
| `pnpm build`     | Build every package                                                        |
| `pnpm test`      | Run Vitest in every package                                                |
| `pnpm lint`      | ESLint and Prettier check                                                  |
| `pnpm format`    | Format with Prettier                                                       |
| `pnpm typecheck` | `tsc --noEmit` in every package                                            |

## Database

```bash
cp .env.example .env
docker compose up -d     # Postgres 16 on localhost:5432 (POSTGRES_PORT in .env changes it)
pnpm db:migrate          # applies apps/api/migrations and sets the passwords of the two roles
pnpm db:unlock           # development only: clears SMS codes and locks
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

### Cards of the customer

```bash
curl http://localhost:3000/v1/public/businesses/navalha                     # no sign-in
curl -X POST http://localhost:3000/v1/customer/businesses/navalha/join   -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
curl http://localhost:3000/v1/customer/enrollments -H "Authorization: Bearer $TOKEN"
```

Expiry is worked out when you read: a cycle past its date shows 0 of N, and nothing is erased.
The seed (`pnpm db:seed`) has the businesses `studio-bela`, `navalha` and `espaco-vita`.

## Looking at screens in development

`pnpm start:dev` runs the real API and the web app on http://localhost:5173. The customer screens
(welcome, sign in, code, name) call the API; there is no simulated session any more.

- **Sign in.** Type a phone number (an existing one from the sample data is `(11) 90000-0000`,
  Maria; any other valid mobile creates a new account and goes to the name step). The code of the
  SMS is **printed in the terminal** where `pnpm start:dev` runs, in a line like:

  ```
  [OTP simulado] +5511900000000 -> 482913 (vale 5 min, até 14:32:10)
  ```

  It is printed only with `NODE_ENV=development`; the API refuses to start in production with the
  console sender.

- **On your phone.** `pnpm start:dev --lan` also opens the web app to your Wi-Fi and prints the
  addresses (use the one that starts with `192.168.`). Open it in the phone's browser; the PC and
  the phone must be on the same network, and Windows may ask to allow Node through the firewall
  (allow it on private networks). The SMS code still shows in the PC terminal. The camera (QR
  reader) will need https later; for now, the sign in and the screens work over http.
- **Reload.** The access token lives in memory only; on reload the app uses the refresh cookie to
  get a new one, so you stay signed in (90 days, renewed on each use).
- **Limits.** The real limits apply (3 codes per hour per number, 5 wrong codes lock the number
  for 15 minutes). `pnpm db:unlock` clears them in your development database.
- **Screens that are not wired yet** (Home, My QR, Profile) still show a placeholder; they are
  built already wired, one task each.
