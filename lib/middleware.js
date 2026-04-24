import { verifyToken } from './auth.js';

export function withAuth(handler) {
  return async function (req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ data: null, error: 'Token não fornecido' });
    }
    const token = authHeader.slice(7);
    try {
      req.user = verifyToken(token);
    } catch {
      return res.status(401).json({ data: null, error: 'Token inválido ou expirado' });
    }
    return handler(req, res);
  };
}
