CREATE TABLE IF NOT EXISTS secoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prova_id    UUID REFERENCES provas(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  questao_de  INTEGER NOT NULL,
  questao_ate INTEGER NOT NULL,
  ordem       INTEGER NOT NULL
);
