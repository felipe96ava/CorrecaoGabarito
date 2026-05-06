import { createServer } from 'http';
import { readFileSync } from 'fs';
import { dispatchApiRequest } from './lib/api/dispatch.js';

// Carrega .env.local
const envRaw = readFileSync('.env.local', 'utf8');
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

// Evita que a API local morra (ECONNRESET no proxy do Vite) por erros não tratados.
process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err?.stack || err?.message || err);
});
process.on('unhandledRejection', (err) => {
  console.error('[FATAL] unhandledRejection:', err?.stack || err?.message || err);
});

// Adiciona .status().json() ao ServerResponse nativo (Node puro; Vercel já injeta helpers).
function decorarRes(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
    return res;
  };
  return res;
}

const server = createServer(async (req, res) => {
  decorarRes(res);
  await dispatchApiRequest(req, res);
});

// Loga erros de socket (útil quando o Vite reporta ECONNRESET).
server.on('clientError', (err, socket) => {
  console.error('[SOCKET] clientError:', err?.code || err?.message || err);
  try {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  } catch {
    // ignore
  }
});

server.listen(3001, '127.0.0.1', () => {
  console.log('✓ API local rodando em http://127.0.0.1:3001');
  console.log('  Inicie o frontend com: npm run dev');
});
