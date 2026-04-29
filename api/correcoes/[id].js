import { neon } from '@neondatabase/serverless';
import { withAuth } from '../../lib/middleware.js';

async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  const { id } = req.query;

  if (req.method === 'GET') {
    const [correcao] = await sql`
      SELECT c.*, a.nome AS aluno_nome, a.turma, a.serie, p.nome AS prova_nome
      FROM correcoes c
      LEFT JOIN alunos a ON a.id = c.aluno_id
      LEFT JOIN provas p ON p.id = c.prova_id
      WHERE c.id = ${id}
    `;
    if (!correcao) return res.status(404).json({ data: null, error: 'Correção não encontrada' });
    return res.status(200).json({ data: correcao, error: null });
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM correcoes WHERE id = ${id}`;
    return res.status(200).json({ data: { deleted: true }, error: null });
  }

  return res.status(405).json({ data: null, error: 'Método não permitido' });
}

export default withAuth(handler);
