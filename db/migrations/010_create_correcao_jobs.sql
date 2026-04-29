-- Tabela usada para acompanhar o progresso da correção de um cartão.
-- O cliente cria a linha (POST /correcoes/jobs), envia o arquivo e poll o
-- status (GET /correcoes/jobs/:id) enquanto o /correcoes/upload roda em
-- paralelo e atualiza o step a cada etapa concluída.
CREATE TABLE IF NOT EXISTS correcao_jobs (
  id            UUID PRIMARY KEY,
  prova_id      UUID NOT NULL REFERENCES provas(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  arquivo_nome  TEXT,
  step          INT NOT NULL DEFAULT 0,         -- 0..5 (ver lib/jobs.js)
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | processing | done | error
  error_message TEXT,
  correcao_id   UUID REFERENCES correcoes(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_correcao_jobs_prova ON correcao_jobs (prova_id);
CREATE INDEX IF NOT EXISTS idx_correcao_jobs_user  ON correcao_jobs (user_id);
