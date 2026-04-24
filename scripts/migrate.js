import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

function loadDotEnvLocalIfPresent() {
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return;
  const raw = fs.readFileSync(p, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

async function main() {
  loadDotEnvLocalIfPresent();
  const databaseUrl = requireEnv('DATABASE_URL');
  const sql = neon(databaseUrl);

  const migrationsDir = path.join(process.cwd(), 'db', 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  const appliedRows = await sql`SELECT filename FROM schema_migrations`;
  const applied = new Set(appliedRows.map((r) => r.filename));

  let ran = 0;
  for (const filename of files) {
    if (applied.has(filename)) continue;
    const full = path.join(migrationsDir, filename);
    const content = fs.readFileSync(full, 'utf8').trim();
    if (!content) continue;

    console.log(`> applying ${filename}`);
    await sql(content);
    await sql`INSERT INTO schema_migrations (filename) VALUES (${filename})`;
    ran += 1;
  }

  console.log(ran === 0 ? '✓ no migrations to apply' : `✓ applied ${ran} migration(s)`);
}

main().catch((err) => {
  console.error('[migrate]', err?.message || err);
  process.exit(1);
});

