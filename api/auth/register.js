import { neon } from '@neondatabase/serverless';
import { hashSenha, signToken } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ data: null, error: 'Método não permitido' });
  }

  const { nome, email, senha, unidade } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ data: null, error: 'Nome, email e senha são obrigatórios' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const senhaHash = await hashSenha(senha);
    const [user] = await sql`
      INSERT INTO users (nome, email, senha_hash, unidade)
      VALUES (${nome}, ${email}, ${senhaHash}, ${unidade || null})
      RETURNING id, nome, email, unidade
    `;
    const token = signToken({ id: user.id, email: user.email, nome: user.nome });
    return res.status(201).json({ data: { token, user }, error: null });
  } catch (err) {
    if (err.message.includes('unique')) {
      return res.status(409).json({ data: null, error: 'Email já cadastrado' });
    }
    return res.status(500).json({ data: null, error: err.message });
  }
}
