CREATE TABLE IF NOT EXISTS provas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  nome           TEXT NOT NULL,
  unidade        TEXT,
  ano_escolar    TEXT,
  modalidade     TEXT,
  etapa          TEXT,
  caderno        TEXT,
  data_prova     DATE,
  total_questoes INTEGER NOT NULL,
  alternativas   TEXT NOT NULL DEFAULT 'A-E',
  status         TEXT NOT NULL DEFAULT 'rascunho',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
