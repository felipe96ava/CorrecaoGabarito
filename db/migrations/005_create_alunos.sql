CREATE TABLE IF NOT EXISTS alunos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prova_id   UUID REFERENCES provas(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  turma      TEXT,
  serie      TEXT,
  turno      TEXT,
  numero     TEXT,
  qr_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
