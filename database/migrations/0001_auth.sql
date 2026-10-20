CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  email VARCHAR(254) NOT NULL CHECK (email = lower(btrim(email))),
  password_hash TEXT NOT NULL,
  role VARCHAR(12) NOT NULL CHECK (role IN ('seeker', 'landlord', 'admin')),
  account_status VARCHAR(12) NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_ci ON users (lower(email));
-- Schema expected by connect-pg-simple; the adapter must not create it at runtime.
CREATE TABLE session (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX session_expire_idx ON session (expire);
