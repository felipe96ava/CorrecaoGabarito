import { neon } from '@neondatabase/serverless';
import { recalcularCorrecao } from '../../lib/corrigir.js';

function unauthorized(res) {
  return res.status(401).json({ data: null, error: 'Não autorizado' });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ data: null, error: 'Método não permitido' });
  }

  const secret = process.env.REPROCESS_WEBHOOK_SECRET;
  if (secret) {
    const headerSecret = req.headers['x-webhook-secret'];
    if (!headerSecret || headerSecret !== secret) return unauthorized(res);
  }

  const { prova_id } = req.body || {};
  if (!prova_id) return res.status(400).json({ data: null, error: 'prova_id é obrigatório' });

  const sql = neon(process.env.DATABASE_URL);

  const [prova] = await sql`SELECT * FROM provas WHERE id = ${prova_id}`;
  if (!prova) return res.status(404).json({ data: null, error: 'Prova não encontrada' });

  const secoes = await sql`SELECT * FROM secoes WHERE prova_id = ${prova_id} ORDER BY ordem`;
  const gabarito = await sql`SELECT * FROM gabarito WHERE prova_id = ${prova_id} ORDER BY numero`;
  const jsonProva = { ...prova, secoes, gabarito };

  const correcoes = await sql`
    SELECT id, respostas_aluno
    FROM correcoes
    WHERE prova_id = ${prova_id}
    ORDER BY processado_em ASC
  `;

  let atualizadas = 0;
  for (const c of correcoes) {
    const calc = recalcularCorrecao({
      respostasAluno: c.respostas_aluno,
      jsonProva,
    });

    await sql`
      UPDATE correcoes
      SET correcao_questoes = ${JSON.stringify(calc.correcao_questoes)},
          resultado_secoes = ${JSON.stringify(calc.resultado_secoes)},
          total_acertos = ${calc.total_acertos},
          nota = ${calc.nota},
          status = ${calc.status}
      WHERE id = ${c.id}
    `;
    atualizadas += 1;
  }

  return res.status(200).json({ data: { prova_id, atualizadas }, error: null });
}

