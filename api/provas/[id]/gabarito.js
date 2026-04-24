import { neon } from '@neondatabase/serverless';
import { withAuth } from '../../../lib/middleware.js';

async function dispararReprocessamento(req, provaId) {
  const secret = process.env.REPROCESS_WEBHOOK_SECRET;
  if (!secret) return;

  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host) return;

  const url = `${proto}://${host}/api/webhooks/reprocess-prova`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-secret': secret,
      },
      body: JSON.stringify({ prova_id: provaId }),
    });
  } catch (err) {
    console.error('[gabarito] Falha ao disparar reprocessamento:', err?.message || err);
  }
}

async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  const { id } = req.query;

  if (req.method !== 'POST') {
    return res.status(405).json({ data: null, error: 'Método não permitido' });
  }

  const [prova] = await sql`SELECT id FROM provas WHERE id = ${id} AND user_id = ${req.user.id}`;
  if (!prova) return res.status(404).json({ data: null, error: 'Prova não encontrada' });

  const { gabarito } = req.body;
  if (!gabarito || !Array.isArray(gabarito)) {
    return res.status(400).json({ data: null, error: 'Gabarito inválido' });
  }

  await sql`DELETE FROM gabarito WHERE prova_id = ${id}`;

  for (const item of gabarito) {
    await sql`
      INSERT INTO gabarito (prova_id, numero, resposta)
      VALUES (${id}, ${item.numero}, ${item.resposta})
    `;
  }

  const salvo = await sql`SELECT * FROM gabarito WHERE prova_id = ${id} ORDER BY numero`;
  await dispararReprocessamento(req, id);
  return res.status(200).json({ data: salvo, error: null });
}

export default withAuth(handler);
