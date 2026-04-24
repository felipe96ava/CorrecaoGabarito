import { createServer } from 'http';
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import path from 'path';

// Carrega .env.local
const envRaw = readFileSync('.env.local', 'utf8');
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const ROOT = process.cwd();

// Mapa de rotas: [regex, arquivo, nomes dos params]
const ROTAS = [
  [/^\/auth\/login$/, 'api/auth/login.js', []],
  [/^\/auth\/register$/, 'api/auth/register.js', []],
  [/^\/provas\/([^/]+)\/gabarito$/, 'api/provas/[id]/gabarito.js', ['id']],
  [/^\/provas\/([^/]+)$/, 'api/provas/[id].js', ['id']],
  [/^\/provas$/, 'api/provas/index.js', []],
  [/^\/alunos\/([^/]+)$/, 'api/alunos/[id].js', ['id']],
  [/^\/alunos$/, 'api/alunos/index.js', []],
  [/^\/correcoes\/upload$/, 'api/correcoes/upload.js', []],
  [/^\/correcoes\/([^/]+)$/, 'api/correcoes/[id].js', ['id']],
  [/^\/correcoes$/, 'api/correcoes/index.js', []],
  [/^\/relatorios\/prova\/([^/]+)$/, 'api/relatorios/prova/[id].js', ['id']],
  [/^\/relatorios\/aluno\/([^/]+)$/, 'api/relatorios/aluno/[id].js', ['id']],
];

function resolverRota(pathname) {
  const p = pathname.replace(/^\/api/, '') || '/';
  for (const [regex, arquivo, params] of ROTAS) {
    const m = p.match(regex);
    if (m) {
      const query = {};
      params.forEach((nome, i) => (query[nome] = m[i + 1]));
      return { arquivo, query };
    }
  }
  return null;
}

// Adiciona .status().json() ao ServerResponse nativo
function decorarRes(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };
  return res;
}

const cache = {};

async function carregarHandler(arquivo) {
  if (!cache[arquivo]) {
    const url = pathToFileURL(path.join(ROOT, arquivo)).href;
    const mod = await import(url);
    cache[arquivo] = mod.default;
  }
  return cache[arquivo];
}

const server = createServer(async (req, res) => {
  decorarRes(res);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost:3001');

  if (!url.pathname.startsWith('/api/')) {
    res.statusCode = 404;
    res.end(JSON.stringify({ data: null, error: 'Rota não encontrada' }));
    return;
  }

  const rota = resolverRota(url.pathname);
  if (!rota) {
    res.statusCode = 404;
    res.end(JSON.stringify({ data: null, error: `Rota ${url.pathname} não mapeada` }));
    return;
  }

  req.query = { ...Object.fromEntries(url.searchParams), ...rota.query };

  // Lê body apenas se não for multipart (formidable lê o stream diretamente)
  const ct = req.headers['content-type'] || '';
  if (!ct.includes('multipart/form-data')) {
    let raw = '';
    await new Promise((resolve) => {
      req.on('data', (c) => (raw += c));
      req.on('end', resolve);
    });
    try {
      req.body = raw ? JSON.parse(raw) : {};
    } catch {
      req.body = {};
    }
  }

  try {
    const handler = await carregarHandler(rota.arquivo);
    await handler(req, res);
  } catch (err) {
    console.error(`[ERRO] ${req.method} ${url.pathname}:`, err.message);
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ data: null, error: err.message }));
    }
  }
});

server.listen(3001, () => {
  console.log('✓ API local rodando em http://localhost:3001');
  console.log('  Inicie o frontend com: npm run dev');
});
