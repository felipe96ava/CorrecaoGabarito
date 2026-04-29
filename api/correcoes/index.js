import { neon } from '@neondatabase/serverless';
import { withAuth } from '../../lib/middleware.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ data: null, error: 'Método não permitido' });
  }

  const sql = neon(process.env.DATABASE_URL);
  const { prova_id, aluno_id } = req.query;

  let correcoes;
  if (prova_id) {
    correcoes = await sql`
      SELECT c.*, a.nome AS aluno_nome, a.turma, a.serie
      FROM correcoes c
      LEFT JOIN alunos a ON a.id = c.aluno_id
      WHERE c.prova_id = ${prova_id}
      ORDER BY c.processado_em DESC
    `;
  } else if (aluno_id) {
    correcoes = await sql`
      SELECT c.*, p.nome AS prova_nome
      FROM correcoes c
      LEFT JOIN provas p ON p.id = c.prova_id
      WHERE c.aluno_id = ${aluno_id}
      ORDER BY c.processado_em DESC
    `;
  } else {
    correcoes = await sql`
      SELECT c.*, a.nome AS aluno_nome, p.nome AS prova_nome
      FROM correcoes c
      LEFT JOIN alunos a ON a.id = c.aluno_id
      LEFT JOIN provas p ON p.id = c.prova_id
      WHERE p.user_id = ${req.user.id}
      ORDER BY c.processado_em DESC
    `;
  }

  return res.status(200).json({ data: correcoes, error: null });
}

export default withAuth(handler);
