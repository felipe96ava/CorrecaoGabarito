/**
 * Um único ponto com as rotas da API — usado pelo router da Vercel e pelo server.local.js.
 * Os handlers vivem em lib/api-handlers/ (fora de /api/) para não virarem funções extras no Hobby.
 */
export const ROUTE_TABLE = [
  [/^\/auth\/login$/, () => import('../api-handlers/auth/login.js'), []],
  [/^\/auth\/register$/, () => import('../api-handlers/auth/register.js'), []],
  [/^\/webhooks\/reprocess-prova$/, () => import('../api-handlers/webhooks/reprocess-prova.js'), []],
  [/^\/provas\/([^/]+)\/gabarito$/, () => import('../api-handlers/provas/gabarito.js'), ['id']],
  [/^\/provas\/([^/]+)\/omr$/, () => import('../api-handlers/provas/omr.js'), ['id']],
  [/^\/provas\/([^/]+)$/, () => import('../api-handlers/provas/prova-by-id.js'), ['id']],
  [/^\/provas$/, () => import('../api-handlers/provas/index.js'), []],
  [/^\/alunos\/([^/]+)$/, () => import('../api-handlers/alunos/aluno-by-id.js'), ['id']],
  [/^\/alunos$/, () => import('../api-handlers/alunos/index.js'), []],
  [/^\/correcoes\/upload$/, () => import('../api-handlers/correcoes/upload.js'), []],
  [/^\/correcoes\/jobs$/, () => import('../api-handlers/correcoes/jobs/index.js'), []],
  [/^\/correcoes\/jobs\/([^/]+)$/, () => import('../api-handlers/correcoes/jobs/job-by-id.js'), ['id']],
  [/^\/correcoes\/([^/]+)$/, () => import('../api-handlers/correcoes/correcao-by-id.js'), ['id']],
  [/^\/correcoes$/, () => import('../api-handlers/correcoes/index.js'), []],
  [/^\/relatorios\/prova\/([^/]+)$/, () => import('../api-handlers/relatorios/prova-by-id.js'), ['id']],
  [/^\/relatorios\/aluno\/([^/]+)$/, () => import('../api-handlers/relatorios/aluno-by-id.js'), ['id']],
];

export function resolveApiPath(pathname) {
  const p = pathname.replace(/^\/api/, '') || '/';
  for (const [regex, importer, params] of ROUTE_TABLE) {
    const m = p.match(regex);
    if (m) {
      const query = {};
      params.forEach((nome, i) => {
        query[nome] = m[i + 1];
      });
      return { importer, query };
    }
  }
  return null;
}
