import { dispatchApiRequest } from '../lib/api/dispatch.js';

export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const apiPath = url.searchParams.get('path') || '';

  // Recria a URL original sob /api/* para o dispatcher.
  url.pathname = `/api/${apiPath}`.replace(/\/+$/, '').replace(/\/{2,}/g, '/');
  url.search = '';
  req.url = url.pathname;

  return dispatchApiRequest(req, res);
}

