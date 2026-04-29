import { neon } from '@neondatabase/serverless';
import { withAuth } from '../../../lib/middleware.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ data: null, error: 'Método não permitido' });
  }

  const sql = neon(process.env.DATABASE_URL);
  const { id } = req.query;

  const [aluno] = await sql`SELECT * FROM alunos WHERE id = ${id}`;
  if (!aluno) return res.status(404).json({ data: null, error: 'Aluno não encontrado' });

  const historico = await sql`
    SELECT c.*, p.nome AS prova_nome, p.data_prova, p.etapa
    FROM correcoes c
    LEFT JOIN provas p ON p.id = c.prova_id
    WHERE c.aluno_id = ${id}
    ORDER BY p.data_prova DESC
  `;

  return res.status(200).json({ data: { aluno, historico }, error: null });
}

export default withAuth(handler);
