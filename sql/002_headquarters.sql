-- Permanent ROGUE FACTORY player bases.
-- Server stores only SHA256 of random bearer tokens; no emails/PII required.
CREATE TABLE IF NOT EXISTS home_accounts (
 id UUID PRIMARY KEY,
 token_hash CHAR(64) NOT NULL UNIQUE,
 display_name VARCHAR(20) NOT NULL,
 base JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS home_accounts_updated_idx ON home_accounts (updated_at DESC);
CREATE TABLE IF NOT EXISTS home_raids (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 attacker_id UUID NOT NULL REFERENCES home_accounts(id) ON DELETE CASCADE,
 defender_id UUID NOT NULL REFERENCES home_accounts(id) ON DELETE CASCADE,
 attacker_name VARCHAR(20) NOT NULL,
 defender_name VARCHAR(20) NOT NULL,
 victory BOOLEAN NOT NULL,
 loot INTEGER NOT NULL DEFAULT 0 CHECK(loot>=0),
 attack_score INTEGER NOT NULL,
 defense_score INTEGER NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CONSTRAINT no_self_raid CHECK(attacker_id<>defender_id)
);
CREATE INDEX IF NOT EXISTS home_raids_attacker_idx ON home_raids (attacker_id,created_at DESC);
CREATE INDEX IF NOT EXISTS home_raids_defender_idx ON home_raids (defender_id,created_at DESC);
