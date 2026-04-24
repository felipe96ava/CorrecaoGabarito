CREATE TABLE IF NOT EXISTS omr_config (
  prova_id           UUID PRIMARY KEY REFERENCES provas(id) ON DELETE CASCADE,
  box_bolhas_1_20    JSONB NOT NULL,
  atualizado_em      TIMESTAMPTZ DEFAULT NOW()
);

