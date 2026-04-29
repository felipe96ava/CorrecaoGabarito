import { neon } from '@neondatabase/serverless';
import { withAuth } from '../../lib/middleware.js';

async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  const { id } = req.query;

  if (req.method === 'GET') {
    const [prova] = await sql`SELECT * FROM provas WHERE id = ${id} AND user_id = ${req.user.id}`;
    if (!prova) return res.status(404).json({ data: null, error: 'Prova não encontrada' });

    const secoes = await sql`SELECT * FROM secoes WHERE prova_id = ${id} ORDER BY ordem`;
    const gabarito = await sql`SELECT * FROM gabarito WHERE prova_id = ${id} ORDER BY numero`;
    return res.status(200).json({ data: { ...prova, secoes, gabarito }, error: null });
  }

  if (req.method === 'PUT') {
    const { nome, unidade, ano_escolar, modalidade, etapa, caderno, data_prova, total_questoes, alternativas, status, secoes } =
      req.body;
    const [prova] = await sql`
      UPDATE provas
      SET nome = ${nome}, unidade = ${unidade}, ano_escolar = ${ano_escolar},
          modalidade = ${modalidade}, etapa = ${etapa}, caderno = ${caderno},
          data_prova = ${data_prova}, total_questoes = ${total_questoes},
          alternativas = ${alternativas}, status = COALESCE(${status || null}, status)
      WHERE id = ${id} AND user_id = ${req.user.id}
      RETURNING *
    `;
    if (!prova) return res.status(404).json({ data: null, error: 'Prova não encontrada' });

    if (secoes) {
      await sql`DELETE FROM secoes WHERE prova_id = ${id}`;
      for (let i = 0; i < secoes.length; i++) {
        const s = secoes[i];
        await sql`
          INSERT INTO secoes (prova_id, nome, questao_de, questao_ate, ordem)
          VALUES (${id}, ${s.nome}, ${s.questao_de}, ${s.questao_ate}, ${i + 1})
        `;
      }
    }

    return res.status(200).json({ data: prova, error: null });
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM provas WHERE id = ${id} AND user_id = ${req.user.id}`;
    return res.status(200).json({ data: { deleted: true }, error: null });
  }

  return res.status(405).json({ data: null, error: 'Método não permitido' });
}

export default withAuth(handler);
