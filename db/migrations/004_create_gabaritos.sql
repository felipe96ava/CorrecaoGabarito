CREATE TABLE IF NOT EXISTS gabarito (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prova_id UUID REFERENCES provas(id) ON DELETE CASCADE,
  numero   INTEGER NOT NULL,
  resposta CHAR(1) NOT NULL,
  UNIQUE (prova_id, numero)
);
