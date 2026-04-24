import { neon } from '@neondatabase/serverless';
import { withAuth } from '../../lib/middleware.js';

async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  if (req.method === 'GET') {
    const provas = await sql`
      SELECT * FROM provas
      WHERE user_id = ${req.user.id}
      ORDER BY created_at DESC
    `;
    return res.status(200).json({ data: provas, error: null });
  }

  if (req.method === 'POST') {
    const { nome, unidade, ano_escolar, modalidade, etapa, caderno, data_prova, total_questoes, alternativas, secoes, gabarito } =
      req.body;

    const [prova] = await sql`
      INSERT INTO provas (user_id, nome, unidade, ano_escolar, modalidade, etapa, caderno, data_prova, total_questoes, alternativas)
      VALUES (${req.user.id}, ${nome}, ${unidade || null}, ${ano_escolar || null}, ${modalidade || null},
              ${etapa || null}, ${caderno || null}, ${data_prova || null}, ${total_questoes}, ${alternativas || 'A-E'})
      RETURNING *
    `;

    if (secoes && secoes.length > 0) {
      for (let i = 0; i < secoes.length; i++) {
        const s = secoes[i];
        await sql`
          INSERT INTO secoes (prova_id, nome, questao_de, questao_ate, ordem)
          VALUES (${prova.id}, ${s.nome}, ${s.questao_de}, ${s.questao_ate}, ${i + 1})
        `;
      }
    }

    if (gabarito && gabarito.length > 0) {
      for (const item of gabarito) {
        await sql`
          INSERT INTO gabarito (prova_id, numero, resposta)
          VALUES (${prova.id}, ${item.numero}, ${item.resposta})
        `;
      }
    }

    return res.status(201).json({ data: prova, error: null });
  }

  return res.status(405).json({ data: null, error: 'Método não permitido' });
}

export default withAuth(handler);
