CREATE TABLE IF NOT EXISTS correcoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prova_id            UUID REFERENCES provas(id),
  aluno_id            UUID REFERENCES alunos(id),
  arquivo_url         TEXT,
  qrcode_lido         BOOLEAN DEFAULT FALSE,
  qrcode_valido       BOOLEAN DEFAULT FALSE,
  fonte_identificacao TEXT,
  respostas_aluno     JSONB,
  correcao_questoes   JSONB,
  resultado_secoes    JSONB,
  total_acertos       INTEGER,
  nota                NUMERIC(4, 2),
  status              TEXT,
  observacoes         JSONB,
  processado_em       TIMESTAMPTZ DEFAULT NOW()
);
