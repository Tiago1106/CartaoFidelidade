---
name: api-module
description: How to build a backend feature in apps/api (NestJS, Postgres with RLS, Kysely) following the project's golden rules. Use for every backend task, in particular new tables, domain operations and endpoints.
---

# API module

Read `CLAUDE.md` (golden rules), then `docs/DATA_MODEL.md` and `docs/API.md` for the part you are touching, and the `RN-...` rules in `docs/BUSINESS_RULES.md`.

## Order of work

1. **Migration first.** One numbered SQL migration per change in `apps/api/migrations/`. Never edit an applied migration. A table with `business_id` gets `ENABLE` and `FORCE ROW LEVEL SECURITY` and its policy in the same migration.
2. **RLS test before the code.** Add the isolation test for the new table (business A cannot see business B, no context returns no rows, an insert with a foreign `business_id` fails). For `stamps`, also test that `UPDATE` and `DELETE` fail.
3. **Shared types.** Zod schemas for request and response in `packages/shared`. The API validates with them (`nestjs-zod`). The web app imports the same types.
4. **Module layout.** `apps/api/src/<feature>/` with `*.module.ts`, `*.controller.ts`, `*.service.ts` and a repository that holds the SQL (Kysely). Controllers are thin. Rules live in the service.
5. **Transactions and tenant context.** Each request runs as `app_user` inside a transaction that sets the context with `set_config(..., true)` (`SET LOCAL`). Domain operations (visit, redemption, reversal) follow `docs/DATA_MODEL.md` section 10, with `SELECT ... FOR UPDATE`. `app_system` is used only in the small isolated module.
6. **Time.** Never call `new Date()` or `now()` inside a rule. Inject `Clock`. "End of day" and expiry dates use America/Sao_Paulo. Store UTC.
7. **Errors.** Use the error format and codes of `docs/API.md` (sections 1 and 2). Each code has a test.
8. **Roles and read-only.** Use the central guards. Test that staff cannot call `/v1/owner/*`. Read-only mode is enforced by the central guard, not by each endpoint.
9. **Messages.** Error messages and e-mails shown to people are Brazilian Portuguese, in the API message module. Codes, fields and everything else are English.
10. **Logs.** Never log SMS codes, QR tokens, refresh tokens, passwords or a full phone number.
11. **Tokens.** OTP, refresh, invite and password-reset tokens are stored only as hashes.
12. **Tests.** Real Postgres with Testcontainers for integration tests. Put the rule id in the test name: `it('RN-VIS-05: stamp is refused inside the minimum interval', ...)`. For cycles and expiry use a fake `Clock`.
13. **Contract.** If the contract or a rule changes, update `docs/API.md` or `docs/BUSINESS_RULES.md` in the same commit.
14. **Swagger.** Every endpoint is described with `@nestjs/swagger`.

## Delivery

Use the `approval-workflow` skill. Evidence for a backend task is the test output, the list of migrations, and a short request and response example for each new endpoint (curl or `.http` file). Tiago can run it with `pnpm test` and `pnpm dev`.
