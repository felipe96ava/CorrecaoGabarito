import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import { hashSenha } from '../lib/auth.js';

function loadDotEnvLocalIfPresent() {
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return;
  const raw = fs.readFileSync(p, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

async function main() {
  const email = process.argv[2];
  const novaSenha = process.argv[3];
  if (!email || !novaSenha) {
    console.error('Uso: node scripts/reset-password.js <email> <novaSenha>');
    process.exit(1);
  }

  loadDotEnvLocalIfPresent();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Defina DATABASE_URL no ambiente ou em .env.local');
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const [user] = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (!user) {
    console.error('Usuário não encontrado:', email);
    process.exit(1);
  }

  const senha_hash = await hashSenha(novaSenha);
  await sql`UPDATE users SET senha_hash = ${senha_hash} WHERE email = ${email}`;
  console.log('Senha atualizada para', email);
}

main().catch((err) => {
  console.error('[reset-password]', err?.message || err);
  process.exit(1);
});
