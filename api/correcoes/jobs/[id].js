import { neon } from '@neondatabase/serverless';
import { withAuth } from '../../../lib/middleware.js';
import { STATUS } from '../../../lib/jobs.js';

// Job que ficou parado em "processing" por mais que esse tempo é considerado
// zumbi (a função que estava processando provavelmente morreu sem gravar erro).
const ZOMBIE_THRESHOLD_SECS = 120;

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ data: null, error: 'Método não permitido' });
  }

  const sql = neon(process.env.DATABASE_URL);
  const { id } = req.query;
  if (!id) return res.status(400).json({ data: null, error: 'id obrigatório' });

  const [job] = await sql`
    SELECT id, prova_id, arquivo_nome, step, status, error_message, correcao_id,
           EXTRACT(EPOCH FROM (NOW() - updated_at)) AS seconds_since_update
    FROM correcao_jobs
    WHERE id = ${id} AND user_id = ${req.user.id}
  `;
  if (!job) return res.status(404).json({ data: null, error: 'Job não encontrado' });

  // Auto-falhar jobs zumbis (a request /upload deve ter morrido).
  if (
    job.status === STATUS.PROCESSING &&
    Number(job.seconds_since_update) > ZOMBIE_THRESHOLD_SECS
  ) {
    await sql`
      UPDATE correcao_jobs
      SET status = ${STATUS.ERROR},
          error_message = COALESCE(error_message, 'O processamento parou de responder. Tente novamente.'),
          updated_at = NOW()
      WHERE id = ${id}
    `;
    job.status = STATUS.ERROR;
    if (!job.error_message) {
      job.error_message = 'O processamento parou de responder. Tente novamente.';
    }
  }

  delete job.seconds_since_update;
  return res.status(200).json({ data: job, error: null });
}

export default withAuth(handler);
