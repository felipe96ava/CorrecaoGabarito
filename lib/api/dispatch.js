import { resolveApiPath } from './routeTable.js';

function corsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-webhook-secret');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
}

/**
 * Enfileira a API sob /api/*. Usado pela função única da Vercel e por server.local.js.
 */
export async function dispatchApiRequest(req, res) {
  corsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url || '/', 'http://localhost');
  if (!url.pathname.startsWith('/api/')) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: null, error: 'Rota não encontrada' }));
    return;
  }

  const rota = resolveApiPath(url.pathname);
  if (!rota) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: null, error: `Rota ${url.pathname} não mapeada` }));
    return;
  }

  req.query = { ...Object.fromEntries(url.searchParams), ...rota.query };

  const ct = req.headers['content-type'] || '';
  if (!ct.includes('multipart/form-data')) {
    let raw = '';
    await new Promise((resolve) => {
      req.on('data', (c) => {
        raw += c;
      });
      req.on('end', resolve);
    });
    try {
      req.body = raw ? JSON.parse(raw) : {};
    } catch {
      req.body = {};
    }
  }

  try {
    const mod = await rota.importer();
    const handler = mod.default;
    await handler(req, res);
  } catch (err) {
    console.error(`[api] ${req.method} ${url.pathname}:`, err?.stack || err?.message || err);
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ data: null, error: err.message }));
    }
  }
}
