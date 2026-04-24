import { neon } from '@neondatabase/serverless';
import { verificarSenha, signToken } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ data: null, error: 'Método não permitido' });
  }

  const { email, senha } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ data: null, error: 'Email e senha são obrigatórios' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const [user] = await sql`SELECT * FROM users WHERE email = ${email}`;

    if (!user || !(await verificarSenha(senha, user.senha_hash))) {
      return res.status(401).json({ data: null, error: 'Credenciais inválidas' });
    }

    const token = signToken({ id: user.id, email: user.email, nome: user.nome });
    return res.status(200).json({
      data: { token, user: { id: user.id, nome: user.nome, email: user.email, unidade: user.unidade } },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({ data: null, error: err.message });
  }
}
