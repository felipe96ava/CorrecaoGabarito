import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const SECRET = process.env.JWT_SECRET;

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

export async function hashSenha(senha) {
  return bcrypt.hash(senha, 10);
}

export async function verificarSenha(senha, hash) {
  return bcrypt.compare(senha, hash);
}
