-- Anonymous alpha match history; accounts, ratings and inventory are future work.
-- public_id is a random match identifier, not an authentication credential.
CREATE TABLE IF NOT EXISTS matches (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id TEXT NOT NULL UNIQUE,
    mode TEXT NOT NULL CHECK (mode IN ('solo', 'pvp')),
    player_a VARCHAR(20) NOT NULL,
    player_b VARCHAR(20) NOT NULL,
    winner TEXT,
    result TEXT,
    seconds INTEGER NOT NULL CHECK (seconds >= 0),
    damage_a DOUBLE PRECISION NOT NULL DEFAULT 0,
    damage_b DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS matches_created_at_idx ON matches (created_at DESC);
