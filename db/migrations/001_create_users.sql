CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  unidade    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
