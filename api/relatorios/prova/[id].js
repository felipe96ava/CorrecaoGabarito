import { neon } from '@neondatabase/serverless';
import { withAuth } from '../../../lib/middleware.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ data: null, error: 'Método não permitido' });
  }

  const sql = neon(process.env.DATABASE_URL);
  const { id } = req.query;

  const [prova] = await sql`SELECT * FROM provas WHERE id = ${id} AND user_id = ${req.user.id}`;
  if (!prova) return res.status(404).json({ data: null, error: 'Prova não encontrada' });

  const secoes = await sql`SELECT * FROM secoes WHERE prova_id = ${id} ORDER BY ordem`;
  const correcoes = await sql`
    SELECT c.*, a.nome AS aluno_nome, a.turma, a.serie
    FROM correcoes c
    LEFT JOIN alunos a ON a.id = c.aluno_id
    WHERE c.prova_id = ${id}
    ORDER BY a.nome
  `;

  const total = correcoes.length;
  const aprovados = correcoes.filter((c) => c.status === 'APROVADO').length;
  const mediaGeral =
    total > 0 ? (correcoes.reduce((acc, c) => acc + parseFloat(c.nota || 0), 0) / total).toFixed(2) : 0;

  return res.status(200).json({
    data: { prova, secoes, correcoes, resumo: { total, aprovados, reprovados: total - aprovados, mediaGeral } },
    error: null,
  });
}

export default withAuth(handler);
