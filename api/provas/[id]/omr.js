import { neon } from '@neondatabase/serverless';
import { withAuth } from '../../../lib/middleware.js';

function isValidRatioBox(box) {
  if (!box || typeof box !== 'object') return false;
  const { x, y, w, h } = box;
  const nums = [x, y, w, h];
  if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) return false;
  if (w <= 0 || h <= 0) return false;
  if (x < 0 || y < 0) return false;
  if (x > 1 || y > 1) return false;
  if (w > 1 || h > 1) return false;
  if (x + w > 1.01 || y + h > 1.01) return false;
  return true;
}

async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  const { id } = req.query;

  const [prova] = await sql`SELECT id FROM provas WHERE id = ${id} AND user_id = ${req.user.id}`;
  if (!prova) return res.status(404).json({ data: null, error: 'Prova não encontrada' });

  if (req.method === 'GET') {
    const [cfg] = await sql`SELECT * FROM omr_config WHERE prova_id = ${id}`;
    return res.status(200).json({ data: cfg || null, error: null });
  }

  if (req.method === 'PUT') {
    const { box_bolhas_1_20 } = req.body || {};
    if (!isValidRatioBox(box_bolhas_1_20)) {
      return res.status(400).json({ data: null, error: 'box_bolhas_1_20 inválido (use proporções 0-1)' });
    }

    const payload = { ...box_bolhas_1_20, unit: 'ratio' };

    const [saved] = await sql`
      INSERT INTO omr_config (prova_id, box_bolhas_1_20)
      VALUES (${id}, ${JSON.stringify(payload)})
      ON CONFLICT (prova_id) DO UPDATE
      SET box_bolhas_1_20 = EXCLUDED.box_bolhas_1_20,
          atualizado_em = NOW()
      RETURNING *
    `;
    return res.status(200).json({ data: saved, error: null });
  }

  return res.status(405).json({ data: null, error: 'Método não permitido' });
}

export default withAuth(handler);

