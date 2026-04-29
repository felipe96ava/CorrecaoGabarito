// Helper para a tabela `correcao_jobs`. Mantém a contagem de etapas e os
// estados em UM único lugar para a UI e o backend não saírem do sincronismo.

// Etapas reportadas (mesmo mapping que o ProcessingProgress no frontend usa).
//   0  Upload                — set pelo cliente ao criar o job
//   1  Pré-processamento     — rotação EXIF / sharp
//   2  Leitura do cartão (OMR)
//   3  Identificação do aluno (QR + cabeçalho via GPT)
//   4  Correção (compara com gabarito + INSERT)
//   5  Concluído
export const STEP = {
  UPLOAD: 0,
  PRE: 1,
  OMR: 2,
  ALUNO: 3,
  CORRECAO: 4,
  DONE: 5,
};

export const TOTAL_STEPS = 6;

export const STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  DONE: 'done',
  ERROR: 'error',
};

// Atualiza um job. `fields` aceita { step, status, error_message, correcao_id }.
// Recebe a instância `sql` já criada (com neon()). Falha silenciosa: o pipeline
// não deve quebrar por causa de um update de progresso.
export async function updateJob(sql, jobId, fields) {
  if (!jobId) return;
  try {
    const step = Number.isFinite(fields?.step) ? fields.step : null;
    const status = typeof fields?.status === 'string' ? fields.status : null;
    const errorMessage =
      typeof fields?.error_message === 'string' ? fields.error_message : null;
    const correcaoId = fields?.correcao_id ?? null;

    await sql`
      UPDATE correcao_jobs
      SET
        step          = COALESCE(${step}, step),
        status        = COALESCE(${status}, status),
        error_message = COALESCE(${errorMessage}, error_message),
        correcao_id   = COALESCE(${correcaoId}, correcao_id),
        updated_at    = NOW()
      WHERE id = ${jobId}
    `;
  } catch (err) {
    console.warn('[jobs] updateJob falhou:', err?.message || err);
  }
}
