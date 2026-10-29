# Modelo de dados

Postgres 16 ou superior. Nomes em inglês, `snake_case`. Chaves primárias `uuid` (gerar UUIDv7 no aplicativo, ou `gen_random_uuid()`). Extensão necessária: `citext`. Todo instante é `timestamptz` em UTC. Datas mostradas ao usuário usam o fuso `America/Sao_Paulo`.

As regras que justificam cada tabela estão em `BUSINESS_RULES.md` (códigos `RN-…`). O DDL abaixo é a **especificação de partida**: o Claude Code deve transformá-lo em migrações e pode ajustar detalhes, mas não deve mudar as garantias descritas (isolamento por tenant, trilha imutável de visitas, ciclos com cópia das regras).

---

## 1. Visão geral

```
businesses ─┬─ staff ── staff_invites
            ├─ subscriptions, billing_events
            ├─ programs ── enrollments ── cycles ── stamps
            │                   │            └── redemptions
            └─ business_customers ── customers
sessions · otp_codes · phone_lockouts · qr_tokens · scan_sessions · sms_messages · audit_log
```

Princípios:

1. **Tenant**: toda tabela de negócio tem `business_id` e RLS.
2. **Cliente global**: `customers` não tem `business_id`. A relação com o negócio fica em `business_customers`.
3. **Visitas só crescem**: `stamps` é append-only. Estorno é uma linha nova (`type = 'reversal'`).
4. **Ciclos guardam as regras**: mudar o cartão não altera ciclos abertos (RN-CAR-04, RN-CIC-02).
5. **Nada é apagado por inadimplência**: o estado do negócio só muda o que ele pode fazer (RN-PLA-06).

---

## 2. Tipos

```sql
CREATE TYPE staff_role          AS ENUM ('owner', 'employee');
CREATE TYPE billing_status      AS ENUM ('trialing', 'active', 'past_due', 'read_only');
CREATE TYPE program_status      AS ENUM ('active', 'archived');
CREATE TYPE enrollment_status   AS ENUM ('active', 'archived');
CREATE TYPE cycle_status        AS ENUM ('open', 'completed', 'expired');
CREATE TYPE stamp_type          AS ENUM ('credit', 'reversal');
CREATE TYPE stamp_method        AS ENUM ('qr', 'phone');
CREATE TYPE redemption_status   AS ENUM ('available', 'redeemed', 'expired', 'canceled');
CREATE TYPE principal_type      AS ENUM ('customer', 'staff');
```

---

## 3. Negócio, equipe e cobrança

```sql
CREATE TABLE businesses (
  id                    uuid PRIMARY KEY,
  name                  text        NOT NULL,
  slug                  text        NOT NULL UNIQUE,          -- /s/<slug>; imutável (RN-TEN-05)
  billing_status        billing_status NOT NULL DEFAULT 'trialing',
  trial_ends_at         timestamptz NOT NULL,                 -- created_at + 30 dias
  current_period_end    timestamptz,                          -- fim do período pago
  cancel_at_period_end  boolean     NOT NULL DEFAULT false,
  past_due_since        timestamptz,                          -- início da carência (RN-PLA-07)
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE staff (
  id                uuid PRIMARY KEY,
  business_id       uuid        NOT NULL REFERENCES businesses(id),
  name              text        NOT NULL,
  email             citext      NOT NULL UNIQUE,              -- único no sistema (RN-AUT-09)
  password_hash     text,                                     -- Argon2id; nulo até aceitar o convite
  role              staff_role  NOT NULL,
  is_active         boolean     NOT NULL DEFAULT true,
  email_verified_at timestamptz,
  last_login_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  deactivated_at    timestamptz
);
-- Um dono por negócio (RN-PER-01)
CREATE UNIQUE INDEX staff_one_owner ON staff (business_id) WHERE role = 'owner';

CREATE TABLE staff_invites (
  id           uuid PRIMARY KEY,
  business_id  uuid        NOT NULL REFERENCES businesses(id),
  staff_id     uuid        NOT NULL REFERENCES staff(id),
  token_hash   text        NOT NULL UNIQUE,
  expires_at   timestamptz NOT NULL,                          -- 7 dias
  accepted_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE plans (                                          -- tabela de configuração, sem RLS
  code                 text PRIMARY KEY,                      -- 'essencial' | 'profissional' | 'studio' | 'grande'
  name                 text    NOT NULL,
  price_cents          integer NOT NULL,
  monthly_stamp_limit  integer NOT NULL,
  mp_plan_id           text,                                  -- id no /preapproval_plan
  is_active            boolean NOT NULL DEFAULT true
);

CREATE TABLE subscriptions (
  id                 uuid PRIMARY KEY,
  business_id        uuid NOT NULL REFERENCES businesses(id),
  plan_code          text NOT NULL REFERENCES plans(code),
  mp_preapproval_id  text NOT NULL UNIQUE,
  mp_status          text NOT NULL,                           -- authorized | paused | cancelled | pending
  started_at         timestamptz,
  ended_at           timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX subscriptions_one_live ON subscriptions (business_id) WHERE ended_at IS NULL;

CREATE TABLE billing_events (                                 -- idempotência dos webhooks (RN-PLA-09)
  id            uuid PRIMARY KEY,
  business_id   uuid REFERENCES businesses(id),
  mp_event_id   text NOT NULL UNIQUE,
  type          text NOT NULL,
  payload       jsonb NOT NULL,
  processed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

---

## 4. Clientes

```sql
CREATE TABLE customers (
  id                 uuid PRIMARY KEY,
  phone_e164         text   NOT NULL UNIQUE,                  -- '+5511912345678'; só +55 (RN-AUT-01)
  name               text,                                    -- nulo até concluir o primeiro acesso
  email              citext,
  terms_accepted_at  timestamptz,
  terms_version      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  anonymized_at      timestamptz,                             -- exclusão LGPD (RN-LGP-04)
  CHECK (phone_e164 ~ '^\+55[1-9][0-9]{9,10}$' OR anonymized_at IS NOT NULL)
);

-- Relação cliente x negócio: lista de clientes do dono e consentimento de marketing
CREATE TABLE business_customers (
  business_id           uuid NOT NULL REFERENCES businesses(id),
  customer_id           uuid NOT NULL REFERENCES customers(id),
  first_seen_at         timestamptz NOT NULL DEFAULT now(),
  marketing_opt_in_at   timestamptz,
  marketing_opt_out_at  timestamptz,
  marketing_source      text,                                 -- 'first_login' | 'settings'
  PRIMARY KEY (business_id, customer_id)
);
```

Na exclusão LGPD, `name`, `email` e `phone_e164` são trocados por valores anônimos (por exemplo `phone_e164 = 'anon:' || id`, e o `CHECK` aceita porque `anonymized_at` não é nulo). As contagens dos negócios continuam corretas.

---

## 5. Cartões, matrículas e ciclos

```sql
CREATE TABLE programs (
  id                    uuid PRIMARY KEY,
  business_id           uuid NOT NULL REFERENCES businesses(id),
  name                  text NOT NULL,
  stamps_required       smallint NOT NULL CHECK (stamps_required BETWEEN 2 AND 30),
  reward_description    text NOT NULL,
  min_interval_minutes  integer  NOT NULL DEFAULT 60  CHECK (min_interval_minutes >= 0),
  validity_days         integer  NOT NULL DEFAULT 30  CHECK (validity_days >= 1),
  reward_validity_days  integer  NOT NULL DEFAULT 30  CHECK (reward_validity_days >= 1),
  card_color            text     NOT NULL DEFAULT '#16181B' CHECK (card_color ~ '^#[0-9A-Fa-f]{6}$'),  -- cor do cartão na carteira do cliente
  status                program_status NOT NULL DEFAULT 'active',
  created_at            timestamptz NOT NULL DEFAULT now(),
  archived_at           timestamptz
);
CREATE INDEX programs_business_status ON programs (business_id, status);

CREATE TABLE enrollments (
  id                uuid PRIMARY KEY,
  business_id       uuid NOT NULL REFERENCES businesses(id),
  customer_id       uuid NOT NULL REFERENCES customers(id),
  program_id        uuid NOT NULL REFERENCES programs(id),
  status            enrollment_status NOT NULL DEFAULT 'active',
  current_cycle_id  uuid,                                     -- FK adicionada abaixo
  last_stamp_at     timestamptz,                              -- última visita (credit) de qualquer ciclo
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, program_id)
);
CREATE INDEX enrollments_business_customer ON enrollments (business_id, customer_id);

CREATE TABLE cycles (
  id                    uuid PRIMARY KEY,
  business_id           uuid NOT NULL REFERENCES businesses(id),
  enrollment_id         uuid NOT NULL REFERENCES enrollments(id),
  number                integer NOT NULL,                     -- 1, 2, 3… por matrícula
  status                cycle_status NOT NULL DEFAULT 'open',
  -- Cópia das regras no início do ciclo (RN-CIC-02)
  stamps_required       smallint NOT NULL,
  reward_description    text     NOT NULL,
  validity_days         integer  NOT NULL,
  reward_validity_days  integer  NOT NULL,
  -- Estado
  last_stamp_at         timestamptz,                          -- última visita não estornada do ciclo
  expires_at            timestamptz,                          -- fim do dia de last_stamp_at + validity_days
  started_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  expired_at            timestamptz,
  UNIQUE (enrollment_id, number)
);
-- No máximo um ciclo aberto por matrícula
CREATE UNIQUE INDEX cycles_one_open ON cycles (enrollment_id) WHERE status = 'open';

ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_current_cycle_fk
  FOREIGN KEY (current_cycle_id) REFERENCES cycles(id) DEFERRABLE INITIALLY DEFERRED;
```

Notas:

- O ciclo é criado **na primeira visita** (e não na matrícula), copiando as regras atuais do cartão. Antes disso, `current_cycle_id` é nulo.
- `expires_at` é recalculado a cada visita e a cada estorno: `(date(last_stamp_at AT TIME ZONE 'America/Sao_Paulo') + validity_days + 1) AT TIME ZONE 'America/Sao_Paulo'`, o que equivale a "vale até o fim do dia" (RN-VAL-04).

---

## 6. Visitas e prêmios

```sql
CREATE TABLE stamps (                                         -- APPEND-ONLY
  id                  uuid PRIMARY KEY,
  business_id         uuid NOT NULL REFERENCES businesses(id),
  enrollment_id       uuid NOT NULL REFERENCES enrollments(id),
  cycle_id            uuid NOT NULL REFERENCES cycles(id),
  customer_id         uuid NOT NULL REFERENCES customers(id),
  staff_id            uuid NOT NULL REFERENCES staff(id),      -- quem registrou (ou quem estornou)
  type                stamp_type NOT NULL DEFAULT 'credit',
  method              stamp_method,                            -- obrigatório quando type = 'credit'
  reverses_stamp_id   uuid REFERENCES stamps(id),              -- obrigatório quando type = 'reversal'
  reason              text,                                    -- obrigatório quando type = 'reversal'
  idempotency_key     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK ( (type = 'credit'   AND method IS NOT NULL AND reverses_stamp_id IS NULL AND reason IS NULL)
       OR (type = 'reversal' AND method IS NULL AND reverses_stamp_id IS NOT NULL AND length(reason) >= 3) )
);
-- Uma visita só é estornada uma vez (RN-EST-03)
CREATE UNIQUE INDEX stamps_one_reversal ON stamps (reverses_stamp_id) WHERE type = 'reversal';
CREATE UNIQUE INDEX stamps_idempotency  ON stamps (business_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX stamps_enrollment_time ON stamps (enrollment_id, created_at DESC);
CREATE INDEX stamps_business_time   ON stamps (business_id, created_at DESC);
CREATE INDEX stamps_staff_time      ON stamps (business_id, staff_id, created_at DESC);

-- Imutabilidade: nenhuma linha muda nem some
CREATE FUNCTION stamps_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'stamps is append-only'; END $$;
CREATE TRIGGER stamps_no_update BEFORE UPDATE OR DELETE ON stamps
  FOR EACH ROW EXECUTE FUNCTION stamps_immutable();
CREATE TRIGGER stamps_no_truncate BEFORE TRUNCATE ON stamps
  FOR EACH STATEMENT EXECUTE FUNCTION stamps_immutable();

CREATE TABLE redemptions (
  id                    uuid PRIMARY KEY,
  business_id           uuid NOT NULL REFERENCES businesses(id),
  enrollment_id         uuid NOT NULL REFERENCES enrollments(id),
  cycle_id              uuid NOT NULL UNIQUE REFERENCES cycles(id),   -- um prêmio por ciclo
  customer_id           uuid NOT NULL REFERENCES customers(id),
  status                redemption_status NOT NULL DEFAULT 'available',
  reward_description    text        NOT NULL,                 -- cópia do ciclo
  earned_at             timestamptz NOT NULL,
  expires_at            timestamptz NOT NULL,                 -- fim do dia de earned_at + reward_validity_days
  redeemed_at           timestamptz,
  redeemed_by_staff_id  uuid REFERENCES staff(id),
  canceled_at           timestamptz,
  cancel_reason         text
);
CREATE INDEX redemptions_enrollment ON redemptions (enrollment_id, status);
```

Um **estorno** de uma visita que sofreu outro estorno é recusado pelo índice único. A **contagem do ciclo** é:

```sql
SELECT count(*) FROM stamps c
WHERE c.cycle_id = $1 AND c.type = 'credit'
  AND NOT EXISTS (SELECT 1 FROM stamps r WHERE r.reverses_stamp_id = c.id);
```

---

## 7. Autenticação, QR e leitura

```sql
CREATE TABLE sessions (
  id                  uuid PRIMARY KEY,
  principal_type      principal_type NOT NULL,
  principal_id        uuid        NOT NULL,                   -- customers.id ou staff.id
  business_id         uuid,                                   -- preenchido para staff
  refresh_token_hash  text        NOT NULL UNIQUE,
  user_agent          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_used_at        timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  revoked_at          timestamptz
);
CREATE INDEX sessions_principal ON sessions (principal_type, principal_id) WHERE revoked_at IS NULL;

CREATE TABLE otp_codes (
  id           uuid PRIMARY KEY,
  phone_e164   text        NOT NULL,
  code_hash    text        NOT NULL,
  ip           inet,
  attempts     smallint    NOT NULL DEFAULT 0,                -- invalida ao chegar a 5
  expires_at   timestamptz NOT NULL,                          -- 5 minutos
  consumed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX otp_phone_time ON otp_codes (phone_e164, created_at DESC);   -- limite de 3 envios/hora
CREATE INDEX otp_ip_time    ON otp_codes (ip, created_at DESC);

CREATE TABLE phone_lockouts (
  phone_e164    text PRIMARY KEY,
  locked_until  timestamptz NOT NULL                          -- 15 minutos (RN-AUT-02)
);

CREATE TABLE qr_tokens (
  id            uuid PRIMARY KEY,                             -- jti, vai dentro do token assinado
  customer_id   uuid        NOT NULL REFERENCES customers(id),
  expires_at    timestamptz NOT NULL,                         -- created_at + 45 s
  consumed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX qr_tokens_expiry ON qr_tokens (expires_at);

CREATE TABLE scan_sessions (
  id            uuid PRIMARY KEY,
  business_id   uuid        NOT NULL REFERENCES businesses(id),
  staff_id      uuid        NOT NULL REFERENCES staff(id),
  customer_id   uuid        NOT NULL REFERENCES customers(id),
  qr_token_id   uuid REFERENCES qr_tokens(id),                -- nulo quando method = 'phone'
  method        stamp_method NOT NULL,
  expires_at    timestamptz NOT NULL,                         -- created_at + 2 min
  consumed_at   timestamptz,                                  -- na visita; o resgate usa outra sessão
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

Limpeza: uma rotina periódica apaga `otp_codes` com mais de 24 horas, `qr_tokens` e `scan_sessions` vencidos há mais de 1 dia e `sessions` expiradas há mais de 30 dias.

### Resgate e `scan_sessions`

`scan/resolve` devolve os cartões e os prêmios disponíveis do cliente. Cada sessão de leitura serve a **uma única ação**: registrar visita **ou** resgatar prêmio. `consumed_at` é marcado pela primeira ação concluída. Para fazer as duas coisas com o mesmo cliente, o funcionário lê o QR de novo, já renovado pelo app do cliente (até 30 s). [Premissa: simplifica e mantém "um QR, uma ação".]

---

## 8. Comunicação e auditoria

```sql
CREATE TABLE sms_messages (                                   -- controle de custo e diagnóstico
  id                   uuid PRIMARY KEY,
  phone_e164           text NOT NULL,
  purpose              text NOT NULL DEFAULT 'otp',
  provider             text NOT NULL,
  provider_message_id  text,
  status               text NOT NULL,                         -- queued | sent | failed
  cost_micro_usd       integer,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id           uuid PRIMARY KEY,
  business_id  uuid REFERENCES businesses(id),
  actor_type   text NOT NULL,                                 -- 'staff' | 'customer' | 'system'
  actor_id     uuid,
  action       text NOT NULL,                                 -- 'stamp.reverse', 'redemption.redeem', 'staff.deactivate', …
  entity       text NOT NULL,
  entity_id    uuid,
  meta         jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_business_time ON audit_log (business_id, created_at DESC);
```

---

## 9. Row Level Security

Dois papéis de banco:

- `app_user`: usado pelas requisições. **Sujeito** a RLS. Não é dono das tabelas.
- `app_system`: usado só por rotinas de sistema (login e OTP do cliente, resolução do QR, webhooks, limpeza, migrações). **Ignora** RLS (`BYPASSRLS`). O código que o usa fica em um módulo isolado e pequeno, revisado com cuidado.

Cada requisição abre uma transação e define o contexto com `SET LOCAL`:

```sql
BEGIN;
SELECT set_config('app.business_id', '<uuid>', true);   -- requisições de funcionário/dono
-- ou
SELECT set_config('app.customer_id', '<uuid>', true);   -- requisições de cliente
-- … comandos …
COMMIT;
```

Política para tabelas com `business_id` (repetir em `staff`, `staff_invites`, `subscriptions`, `programs`, `enrollments`, `cycles`, `stamps`, `redemptions`, `business_customers`, `scan_sessions`, `audit_log`):

```sql
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON programs
  USING      (business_id = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (business_id = nullif(current_setting('app.business_id', true), '')::uuid);
```

`businesses`: política por `id = app.business_id`.

Contexto do cliente (`app.customer_id`) em `enrollments`, `cycles`, `stamps`, `redemptions` e `business_customers`, em modo **somente leitura**:

```sql
CREATE POLICY customer_read ON enrollments FOR SELECT
  USING (customer_id = nullif(current_setting('app.customer_id', true), '')::uuid);
-- Mesmo padrão para stamps, redemptions e business_customers (coluna customer_id).
-- Para cycles, que não tem customer_id: EXISTS (SELECT 1 FROM enrollments e WHERE e.id = cycles.enrollment_id AND e.customer_id = …)
```

As **escritas** do cliente (entrar nos cartões de um salão, alterar o consentimento de marketing, concluir o perfil, pedir exclusão) não ganham políticas de escrita no contexto do cliente. Elas passam por funções pequenas e revisadas do módulo `app_system`, que validam que o `customer_id` da sessão é o dono do dado.

`customers`: o funcionário nunca lê a tabela inteira. Política de leitura do negócio:

```sql
CREATE POLICY business_reads_own_customers ON customers FOR SELECT
  USING (EXISTS (SELECT 1 FROM business_customers bc
                 WHERE bc.customer_id = customers.id
                   AND bc.business_id = nullif(current_setting('app.business_id', true), '')::uuid));
CREATE POLICY customer_self ON customers FOR SELECT
  USING (id = nullif(current_setting('app.customer_id', true), '')::uuid);
CREATE POLICY customer_self_update ON customers FOR UPDATE
  USING (id = nullif(current_setting('app.customer_id', true), '')::uuid);
```

Tabelas sem RLS e acessadas só por `app_system`: `otp_codes`, `phone_lockouts`, `qr_tokens`, `sessions`, `sms_messages`, `billing_events`. `plans` é leitura pública.

**Testes obrigatórios de RLS**: (1) com contexto do negócio A, nenhuma consulta devolve dados do B; (2) sem contexto, nenhuma tabela devolve linhas; (3) `INSERT` com `business_id` de outro negócio falha; (4) `UPDATE`/`DELETE` em `stamps` falha para qualquer papel.

---

## 10. Rotinas de domínio (dentro de uma transação, com bloqueio de linha)

### 10.1 Registrar visita

```
BEGIN (contexto do negócio)
  1. Validar scan_session (existe, do funcionário, não consumida, não vencida) e marcar consumed_at.
  2. INSERT INTO enrollments … ON CONFLICT DO NOTHING; depois SELECT … FOR UPDATE da matrícula (customer_id, program_id).
  3. Verificar business.billing_status ≠ 'read_only' e program.status = 'active'.
  4. Intervalo mínimo: now() - enrollments.last_stamp_at >= program.min_interval_minutes, senão STAMP_TOO_SOON.
  5. Resolver ciclo (10.3): se o ciclo aberto venceu, marcar 'expired'.
  6. Se não há ciclo aberto, criar um copiando as regras atuais do programa; enrollments.current_cycle_id = novo.
  7. INSERT stamps (credit, method, staff_id, idempotency_key).
  8. Atualizar cycle.last_stamp_at e cycle.expires_at; enrollments.last_stamp_at = now().
  9. Se a contagem do ciclo = cycle.stamps_required:
       cycle.status = 'completed', completed_at = now()
       INSERT redemptions (available, earned_at = now(), expires_at = fim do dia de now() + reward_validity_days)
       enrollments.current_cycle_id = NULL   (o próximo ciclo nasce na próxima visita)
 10. INSERT audit_log só para ações sensíveis (visita comum não precisa).
COMMIT
```

### 10.2 Estornar visita (somente dono)

```
BEGIN
  1. Carregar a visita original (type = 'credit', ainda sem estorno) e a matrícula FOR UPDATE.
  2. Se a visita completou o ciclo (cycle.status = 'completed'):
       se o prêmio está 'redeemed' → REVERSAL_NOT_ALLOWED
       se 'available' e não existe ciclo posterior com visitas → prêmio 'canceled'; ciclo volta a 'open'; enrollment.current_cycle_id = ciclo; completed_at = NULL
       se 'available' mas já existe ciclo posterior com visitas → REVERSAL_NOT_ALLOWED (evita dois ciclos abertos)
       se 'expired' → estorno permitido; prêmio permanece 'expired'
  3. Se o ciclo está 'expired': permitido, não reabre (RN-EST-05).
  4. INSERT stamps (reversal, reverses_stamp_id, reason, staff_id = dono).
  5. Recalcular cycle.last_stamp_at e cycle.expires_at (última visita não estornada) e enrollments.last_stamp_at.
  6. INSERT audit_log ('stamp.reverse').
COMMIT
```

### 10.3 Resolver vencimento (chamado em toda leitura e escrita da matrícula)

```
resolveCycle(enrollment, now):
  c = ciclo aberto da matrícula
  se c existe e c.last_stamp_at não é nulo e now > c.expires_at:
      c.status = 'expired', c.expired_at = c.expires_at; enrollment.current_cycle_id = NULL
  prêmios 'available' com expires_at < now viram 'expired' (o servidor aplica ao consultar e antes de resgatar)
```

O app do cliente mostra o ciclo aberto com contagem e a data de vencimento; se o ciclo venceu, mostra 0 de N. Nenhuma tarefa agendada é necessária para a regra; uma rotina diária opcional só grava o estado para os relatórios.

### 10.4 Resgatar prêmio

```
BEGIN
  1. Validar scan_session (como em 10.1).
  2. SELECT redemption FOR UPDATE; resolver vencimento; se 'expired' → PRIZE_EXPIRED; se não 'available' → PRIZE_NOT_AVAILABLE.
  3. status = 'redeemed', redeemed_at = now(), redeemed_by_staff_id = staff.
  4. INSERT audit_log ('redemption.redeem').
COMMIT
```

---

## 11. Consultas do painel (referência)

- **Visitas no período**: `count(*)` de `stamps` com `type='credit'` e sem estorno, filtrado por `created_at`.
- **Clientes ativos**: matrículas com ciclo aberto e `expires_at > now()`.
- **Clientes novos**: `business_customers.first_seen_at` no período.
- **Voltaram**: clientes com 2 ou mais visitas no período.
- **Por funcionário**: `group by staff_id` nas visitas do período.
- **Uso do plano**: visitas do mês corrente (fuso America/Sao_Paulo) contra `plans.monthly_stamp_limit`.

Para volume maior, criar uma tabela de agregados diários por negócio (`daily_stats`) alimentada por job; não é necessária no MVP.

---

## 12. Dados iniciais (seed)

`plans`: `essencial` (3900, 300), `profissional` (7900, 800), `studio` (14900, 2000), `grande` (24900, 5000). Valores em centavos, hipótese de preço (RN-PLA-03).
