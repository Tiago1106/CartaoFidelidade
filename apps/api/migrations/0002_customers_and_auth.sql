-- Customers and the tables of sign-in (docs/DATA_MODEL.md sections 2, 4, 7, 8 and 9).
--
-- `customers` has no `business_id`: a customer is global. Row level security lets a customer
-- read only the own row. Creating the account and every write happen in the small system
-- module (role app_system), which checks that the data belongs to who is acting.
-- The policy of the business that reads its own customers arrives with `business_customers`.
--
-- `otp_codes`, `phone_lockouts`, `sessions` and `sms_messages` are used only by the system
-- module, so app_user gets no right on them at all.

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE principal_type AS ENUM ('customer', 'staff');

-- [Premissa] Ids have a default (`gen_random_uuid()`), so an insert may leave the id out.
CREATE TABLE customers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164         text   NOT NULL UNIQUE,                  -- '+5511912345678'; only +55 (RN-AUT-01)
  name               text,                                    -- null until the first access is done
  email              citext,
  terms_accepted_at  timestamptz,
  terms_version      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  anonymized_at      timestamptz,                             -- LGPD deletion (RN-LGP-04)
  CHECK (phone_e164 ~ '^\+55[1-9][0-9]{9,10}$' OR anonymized_at IS NOT NULL)
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;

-- [Premissa] Only a read policy for the customer. DATA_MODEL section 9 lists a
-- `customer_self_update` policy and also says that customer writes go through app_system. The
-- second is followed: with no write policy, app_user can never change a customer.
CREATE POLICY customer_self ON customers FOR SELECT
  USING (id = nullif(current_setting('app.customer_id', true), '')::uuid);

CREATE TABLE sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_type      principal_type NOT NULL,
  principal_id        uuid        NOT NULL,                   -- customers.id or staff.id
  business_id         uuid,                                   -- filled for staff
  refresh_token_hash  text        NOT NULL UNIQUE,            -- only the hash is kept (golden rule 9)
  user_agent          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_used_at        timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  revoked_at          timestamptz
);
CREATE INDEX sessions_principal ON sessions (principal_type, principal_id) WHERE revoked_at IS NULL;

CREATE TABLE otp_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164   text        NOT NULL,
  code_hash    text        NOT NULL,                          -- only the hash is kept (golden rule 9)
  ip           inet,
  attempts     smallint    NOT NULL DEFAULT 0,                -- the code dies at 5 (RN-AUT-02)
  expires_at   timestamptz NOT NULL,                          -- 5 minutes
  consumed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (attempts >= 0)
);
CREATE INDEX otp_phone_time ON otp_codes (phone_e164, created_at DESC);   -- limit of 3 per hour
CREATE INDEX otp_ip_time    ON otp_codes (ip, created_at DESC);

CREATE TABLE phone_lockouts (
  phone_e164    text PRIMARY KEY,
  locked_until  timestamptz NOT NULL                          -- 15 minutes (RN-AUT-02)
);

CREATE TABLE sms_messages (                                   -- cost control and diagnosis
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164           text NOT NULL,
  purpose              text NOT NULL DEFAULT 'otp',
  provider             text NOT NULL,
  provider_message_id  text,
  status               text NOT NULL CHECK (status IN ('queued', 'sent', 'failed')),
  cost_micro_usd       integer,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Only the system module touches these four. The default privileges of migration 0001 would
-- have given app_user access, so it is taken away here.
REVOKE ALL ON sessions, otp_codes, phone_lockouts, sms_messages FROM app_user;

-- The customer can read the own row and nothing more: no insert, update or delete.
REVOKE INSERT, UPDATE, DELETE ON customers FROM app_user;
