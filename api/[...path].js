import { dispatchApiRequest } from '../lib/api/dispatch.js';

export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
  return dispatchApiRequest(req, res);
}
