-- Businesses, staff, cards, enrollments, cycles, stamps and prizes
-- (docs/DATA_MODEL.md sections 2, 3, 5, 6, 7 and 9).
--
-- Every table of a business has `business_id` and row level security, enabled and forced.
-- A request sets `app.business_id` (staff and owner) or `app.customer_id` (customer) with
-- SET LOCAL. The customer may only read. Creating a business, a customer's enrollment or any
-- write of the customer side goes through the system module (role app_system).
--
-- `stamps` only grows: a trigger refuses UPDATE, DELETE and TRUNCATE for every role.
-- Tables of the billing (plans, subscriptions, billing_events), the invites of the staff,
-- `scan_sessions` and `audit_log` come with the tasks that use them.

CREATE TYPE staff_role        AS ENUM ('owner', 'employee');
CREATE TYPE billing_status    AS ENUM ('trialing', 'active', 'past_due', 'read_only');
CREATE TYPE program_status    AS ENUM ('active', 'archived');
CREATE TYPE enrollment_status AS ENUM ('active', 'archived');
CREATE TYPE cycle_status      AS ENUM ('open', 'completed', 'expired');
CREATE TYPE stamp_type        AS ENUM ('credit', 'reversal');
CREATE TYPE stamp_method      AS ENUM ('qr', 'phone');
CREATE TYPE redemption_status AS ENUM ('available', 'redeemed', 'expired', 'canceled');

-- ---------------------------------------------------------------------------------------------
-- Business and staff
-- ---------------------------------------------------------------------------------------------

CREATE TABLE businesses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text        NOT NULL,
  -- [Premissa] Lowercase words joined by hyphens, so it is safe in /s/<slug>.
  slug                  text        NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- [Premissa] Kind of business, shown under the name on the card (API.md, section 5).
  category              text,
  billing_status        billing_status NOT NULL DEFAULT 'trialing',
  trial_ends_at         timestamptz NOT NULL,                 -- created_at + 30 days
  current_period_end    timestamptz,
  cancel_at_period_end  boolean     NOT NULL DEFAULT false,
  past_due_since        timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- The address of the NFC tags and of the counter QR must never change (RN-TEN-05).
CREATE FUNCTION businesses_slug_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'businesses.slug cannot be changed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER businesses_slug_no_change BEFORE UPDATE OF slug ON businesses
  FOR EACH ROW EXECUTE FUNCTION businesses_slug_immutable();

CREATE TABLE staff (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid        NOT NULL REFERENCES businesses(id),
  name              text        NOT NULL,
  email             citext      NOT NULL UNIQUE,              -- unique in the whole system (RN-AUT-09)
  password_hash     text,                                     -- Argon2id; null until the invite is accepted
  role              staff_role  NOT NULL,
  is_active         boolean     NOT NULL DEFAULT true,
  email_verified_at timestamptz,
  last_login_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  deactivated_at    timestamptz
);
-- One owner per business (RN-PER-01)
CREATE UNIQUE INDEX staff_one_owner ON staff (business_id) WHERE role = 'owner';

-- ---------------------------------------------------------------------------------------------
-- Cards, enrollments and cycles
-- ---------------------------------------------------------------------------------------------

CREATE TABLE programs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           uuid NOT NULL REFERENCES businesses(id),
  name                  text NOT NULL,
  stamps_required       smallint NOT NULL CHECK (stamps_required BETWEEN 2 AND 30),
  reward_description    text NOT NULL,
  min_interval_minutes  integer  NOT NULL DEFAULT 60  CHECK (min_interval_minutes >= 0),
  validity_days         integer  NOT NULL DEFAULT 30  CHECK (validity_days >= 1),
  reward_validity_days  integer  NOT NULL DEFAULT 30  CHECK (reward_validity_days >= 1),
  card_color            text     NOT NULL DEFAULT '#16181B' CHECK (card_color ~ '^#[0-9A-Fa-f]{6}$'),
  status                program_status NOT NULL DEFAULT 'active',
  created_at            timestamptz NOT NULL DEFAULT now(),
  archived_at           timestamptz
);
CREATE INDEX programs_business_status ON programs (business_id, status);

CREATE TABLE business_customers (
  business_id           uuid NOT NULL REFERENCES businesses(id),
  customer_id           uuid NOT NULL REFERENCES customers(id),
  first_seen_at         timestamptz NOT NULL DEFAULT now(),
  marketing_opt_in_at   timestamptz,
  marketing_opt_out_at  timestamptz,
  marketing_source      text,                                 -- 'first_login' | 'settings'
  PRIMARY KEY (business_id, customer_id)
);

CREATE TABLE enrollments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid NOT NULL REFERENCES businesses(id),
  customer_id       uuid NOT NULL REFERENCES customers(id),
  program_id        uuid NOT NULL REFERENCES programs(id),
  status            enrollment_status NOT NULL DEFAULT 'active',
  current_cycle_id  uuid,                                     -- foreign key added below
  last_stamp_at     timestamptz,                              -- last visit (credit) of any cycle
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, program_id)
);
CREATE INDEX enrollments_business_customer ON enrollments (business_id, customer_id);

CREATE TABLE cycles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           uuid NOT NULL REFERENCES businesses(id),
  enrollment_id         uuid NOT NULL REFERENCES enrollments(id),
  number                integer NOT NULL,                     -- 1, 2, 3... per enrollment
  status                cycle_status NOT NULL DEFAULT 'open',
  -- Copy of the rules when the cycle starts (RN-CIC-02, golden rule 4)
  stamps_required       smallint NOT NULL,
  reward_description    text     NOT NULL,
  validity_days         integer  NOT NULL,
  reward_validity_days  integer  NOT NULL,
  -- State
  last_stamp_at         timestamptz,                          -- last visit of the cycle that was not reversed
  expires_at            timestamptz,                          -- end of the day of last_stamp_at + validity_days
  started_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  expired_at            timestamptz,
  UNIQUE (enrollment_id, number)
);
-- At most one open cycle per enrollment
CREATE UNIQUE INDEX cycles_one_open ON cycles (enrollment_id) WHERE status = 'open';

ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_current_cycle_fk
  FOREIGN KEY (current_cycle_id) REFERENCES cycles(id) DEFERRABLE INITIALLY DEFERRED;

-- ---------------------------------------------------------------------------------------------
-- Visits and prizes
-- ---------------------------------------------------------------------------------------------

CREATE TABLE stamps (                                         -- APPEND-ONLY (golden rule 2)
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         uuid NOT NULL REFERENCES businesses(id),
  enrollment_id       uuid NOT NULL REFERENCES enrollments(id),
  cycle_id            uuid NOT NULL REFERENCES cycles(id),
  customer_id         uuid NOT NULL REFERENCES customers(id),
  staff_id            uuid NOT NULL REFERENCES staff(id),      -- who registered it (or who reversed it)
  type                stamp_type NOT NULL DEFAULT 'credit',
  method              stamp_method,                            -- required when type = 'credit'
  reverses_stamp_id   uuid REFERENCES stamps(id),              -- required when type = 'reversal'
  reason              text,                                    -- required when type = 'reversal'
  idempotency_key     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  -- `reason IS NOT NULL` is explicit: with `length(reason) >= 3` alone, a null reason gives null,
  -- and a CHECK that evaluates to null passes. DATA_MODEL.md has that gap.
  CHECK ( (type = 'credit'   AND method IS NOT NULL AND reverses_stamp_id IS NULL AND reason IS NULL)
       OR (type = 'reversal' AND method IS NULL AND reverses_stamp_id IS NOT NULL
                             AND reason IS NOT NULL AND length(reason) >= 3) )
);
-- A visit is reversed only once (RN-EST-03)
CREATE UNIQUE INDEX stamps_one_reversal ON stamps (reverses_stamp_id) WHERE type = 'reversal';
CREATE UNIQUE INDEX stamps_idempotency  ON stamps (business_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX stamps_enrollment_time ON stamps (enrollment_id, created_at DESC);
CREATE INDEX stamps_business_time   ON stamps (business_id, created_at DESC);
CREATE INDEX stamps_staff_time      ON stamps (business_id, staff_id, created_at DESC);

-- Immutability: no row changes and no row goes away, for any role
CREATE FUNCTION stamps_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'stamps is append-only'; END $$;
CREATE TRIGGER stamps_no_update BEFORE UPDATE OR DELETE ON stamps
  FOR EACH ROW EXECUTE FUNCTION stamps_immutable();
CREATE TRIGGER stamps_no_truncate BEFORE TRUNCATE ON stamps
  FOR EACH STATEMENT EXECUTE FUNCTION stamps_immutable();

CREATE TABLE redemptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           uuid NOT NULL REFERENCES businesses(id),
  enrollment_id         uuid NOT NULL REFERENCES enrollments(id),
  cycle_id              uuid NOT NULL UNIQUE REFERENCES cycles(id),   -- one prize per cycle
  customer_id           uuid NOT NULL REFERENCES customers(id),
  status                redemption_status NOT NULL DEFAULT 'available',
  reward_description    text        NOT NULL,                 -- copy of the cycle
  earned_at             timestamptz NOT NULL,
  expires_at            timestamptz NOT NULL,                 -- end of the day of earned_at + reward_validity_days
  redeemed_at           timestamptz,
  redeemed_by_staff_id  uuid REFERENCES staff(id),
  canceled_at           timestamptz,
  cancel_reason         text
);
CREATE INDEX redemptions_enrollment ON redemptions (enrollment_id, status);

-- ---------------------------------------------------------------------------------------------
-- QR token of the customer. Used only by the system module (resolving a scan), so app_user
-- has no right on it.
-- ---------------------------------------------------------------------------------------------

CREATE TABLE qr_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),   -- jti, goes inside the signed token
  customer_id   uuid        NOT NULL REFERENCES customers(id),
  expires_at    timestamptz NOT NULL,                         -- created_at + 45 s
  consumed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX qr_tokens_expiry ON qr_tokens (expires_at);
REVOKE ALL ON qr_tokens FROM app_user;

-- ---------------------------------------------------------------------------------------------
-- Row level security: the business (staff and owner)
-- ---------------------------------------------------------------------------------------------

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON businesses
  USING      (id = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (id = nullif(current_setting('app.business_id', true), '')::uuid);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON staff
  USING      (business_id = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (business_id = nullif(current_setting('app.business_id', true), '')::uuid);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON programs
  USING      (business_id = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (business_id = nullif(current_setting('app.business_id', true), '')::uuid);

ALTER TABLE business_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_customers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON business_customers
  USING      (business_id = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (business_id = nullif(current_setting('app.business_id', true), '')::uuid);

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON enrollments
  USING      (business_id = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (business_id = nullif(current_setting('app.business_id', true), '')::uuid);

ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON cycles
  USING      (business_id = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (business_id = nullif(current_setting('app.business_id', true), '')::uuid);

ALTER TABLE stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE stamps FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON stamps
  USING      (business_id = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (business_id = nullif(current_setting('app.business_id', true), '')::uuid);

ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemptions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON redemptions
  USING      (business_id = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (business_id = nullif(current_setting('app.business_id', true), '')::uuid);

-- ---------------------------------------------------------------------------------------------
-- Row level security: the customer reads only what is theirs. There is no write policy for the
-- customer context, so every write of a customer is refused.
-- ---------------------------------------------------------------------------------------------

CREATE POLICY customer_read ON enrollments FOR SELECT
  USING (customer_id = nullif(current_setting('app.customer_id', true), '')::uuid);

CREATE POLICY customer_read ON cycles FOR SELECT
  USING (EXISTS (SELECT 1 FROM enrollments e
                 WHERE e.id = cycles.enrollment_id
                   AND e.customer_id = nullif(current_setting('app.customer_id', true), '')::uuid));

CREATE POLICY customer_read ON stamps FOR SELECT
  USING (customer_id = nullif(current_setting('app.customer_id', true), '')::uuid);

CREATE POLICY customer_read ON redemptions FOR SELECT
  USING (customer_id = nullif(current_setting('app.customer_id', true), '')::uuid);

CREATE POLICY customer_read ON business_customers FOR SELECT
  USING (customer_id = nullif(current_setting('app.customer_id', true), '')::uuid);

-- [Premissa] The customer also reads the business and the card of an enrollment of the own, to
-- show the name and the color on the card (GET /v1/customer/enrollments). DATA_MODEL section 9
-- does not list these two, but the screen needs them.
CREATE POLICY customer_read ON programs FOR SELECT
  USING (EXISTS (SELECT 1 FROM enrollments e
                 WHERE e.program_id = programs.id
                   AND e.customer_id = nullif(current_setting('app.customer_id', true), '')::uuid));

CREATE POLICY customer_read ON businesses FOR SELECT
  USING (EXISTS (SELECT 1 FROM enrollments e
                 WHERE e.business_id = businesses.id
                   AND e.customer_id = nullif(current_setting('app.customer_id', true), '')::uuid));

-- ---------------------------------------------------------------------------------------------
-- The business reads only the customers it has (the second half of `customers`, see 0002).
-- The staff never reads the whole table.
-- ---------------------------------------------------------------------------------------------

CREATE POLICY business_reads_own_customers ON customers FOR SELECT
  USING (EXISTS (SELECT 1 FROM business_customers bc
                 WHERE bc.customer_id = customers.id
                   AND bc.business_id = nullif(current_setting('app.business_id', true), '')::uuid));
