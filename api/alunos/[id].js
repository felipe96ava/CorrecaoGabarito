import { neon } from '@neondatabase/serverless';
import { withAuth } from '../../lib/middleware.js';

async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  const { id } = req.query;

  if (req.method === 'GET') {
    const [aluno] = await sql`SELECT * FROM alunos WHERE id = ${id}`;
    if (!aluno) return res.status(404).json({ data: null, error: 'Aluno não encontrado' });
    return res.status(200).json({ data: aluno, error: null });
  }

  if (req.method === 'PUT') {
    const { nome, turma, serie, turno, numero } = req.body;
    const [aluno] = await sql`
      UPDATE alunos SET nome = ${nome}, turma = ${turma}, serie = ${serie}, turno = ${turno}, numero = ${numero}
      WHERE id = ${id} RETURNING *
    `;
    return res.status(200).json({ data: aluno, error: null });
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM alunos WHERE id = ${id}`;
    return res.status(200).json({ data: { deleted: true }, error: null });
  }

  return res.status(405).json({ data: null, error: 'Método não permitido' });
}

export default withAuth(handler);
