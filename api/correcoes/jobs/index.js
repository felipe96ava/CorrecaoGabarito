import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'crypto';
import { withAuth } from '../../../lib/middleware.js';
import { STATUS, STEP } from '../../../lib/jobs.js';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ data: null, error: 'Método não permitido' });
  }

  const sql = neon(process.env.DATABASE_URL);
  const body = req.body || {};
  const provaId = body.prova_id;
  const arquivoNome = typeof body.arquivo_nome === 'string' ? body.arquivo_nome.slice(0, 200) : null;
  // O cliente PODE sugerir o id (assim ele já sabe pra onde pollar antes da
  // resposta); se não vier, geramos aqui.
  const clientId = typeof body.id === 'string' && body.id.length >= 8 ? body.id : null;

  if (!provaId) {
    return res.status(400).json({ data: null, error: 'prova_id é obrigatório' });
  }

  const [prova] = await sql`SELECT id FROM provas WHERE id = ${provaId} AND user_id = ${req.user.id}`;
  if (!prova) return res.status(404).json({ data: null, error: 'Prova não encontrada' });

  const id = clientId || randomUUID();

  const [job] = await sql`
    INSERT INTO correcao_jobs (id, prova_id, user_id, arquivo_nome, step, status)
    VALUES (${id}, ${provaId}, ${req.user.id}, ${arquivoNome}, ${STEP.UPLOAD}, ${STATUS.PENDING})
    ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
    RETURNING *
  `;

  return res.status(201).json({ data: job, error: null });
}

export default withAuth(handler);
