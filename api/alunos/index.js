import { neon } from '@neondatabase/serverless';
import { withAuth } from '../../lib/middleware.js';

async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  if (req.method === 'GET') {
    const { prova_id } = req.query;
    const alunos = prova_id
      ? await sql`SELECT * FROM alunos WHERE prova_id = ${prova_id} ORDER BY nome`
      : await sql`
          SELECT a.* FROM alunos a
          INNER JOIN provas p ON p.id = a.prova_id
          WHERE p.user_id = ${req.user.id}
          ORDER BY a.nome
        `;
    return res.status(200).json({ data: alunos, error: null });
  }

  if (req.method === 'POST') {
    const { prova_id, nome, turma, serie, turno, numero } = req.body;
    if (!prova_id || !nome) {
      return res.status(400).json({ data: null, error: 'prova_id e nome são obrigatórios' });
    }

    const qr_payload = { prova_id, nome, turma, serie, turno, numero };

    const [aluno] = await sql`
      INSERT INTO alunos (prova_id, nome, turma, serie, turno, numero, qr_payload)
      VALUES (${prova_id}, ${nome}, ${turma || null}, ${serie || null}, ${turno || null}, ${numero || null}, ${JSON.stringify(qr_payload)})
      RETURNING *
    `;
    return res.status(201).json({ data: aluno, error: null });
  }

  return res.status(405).json({ data: null, error: 'Método não permitido' });
}

export default withAuth(handler);
