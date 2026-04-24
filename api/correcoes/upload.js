import { neon } from '@neondatabase/serverless';
import formidable from 'formidable';
import fs from 'fs';
import { withAuth } from '../../lib/middleware.js';
import { corrigirCartao } from '../../lib/corrigir.js';

export const config = { api: { bodyParser: false } };

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ data: null, error: 'Método não permitido' });
  }

  const form = formidable({ maxFileSize: 4.5 * 1024 * 1024 });
  let fields, files;
  try {
    [fields, files] = await form.parse(req);
  } catch {
    return res.status(400).json({ data: null, error: 'Erro ao processar o arquivo enviado' });
  }

  const prova_id = fields.prova_id?.[0];
  if (!prova_id) {
    return res.status(400).json({ data: null, error: 'prova_id é obrigatório' });
  }

  const arquivo = files.arquivo?.[0];
  if (!arquivo) {
    return res.status(400).json({ data: null, error: 'Arquivo não enviado' });
  }

  const sql = neon(process.env.DATABASE_URL);

  const [prova] = await sql`SELECT * FROM provas WHERE id = ${prova_id} AND user_id = ${req.user.id}`;
  if (!prova) return res.status(404).json({ data: null, error: 'Prova não encontrada' });

  const secoes = await sql`SELECT * FROM secoes WHERE prova_id = ${prova_id} ORDER BY ordem`;
  const gabarito = await sql`SELECT * FROM gabarito WHERE prova_id = ${prova_id} ORDER BY numero`;
  const jsonProva = { ...prova, secoes, gabarito };

  const buffer = fs.readFileSync(arquivo.filepath);
  const imagemBase64 = buffer.toString('base64');
  const mimeType = arquivo.mimetype || 'image/jpeg';

  let resultado;
  try {
    resultado = await corrigirCartao(imagemBase64, mimeType, jsonProva);
  } catch (err) {
    const detalhe = err?.response?.data ?? err?.error ?? err.message;
    console.error('[upload] Erro OpenAI:', JSON.stringify(detalhe, null, 2));
    return res.status(422).json({ data: null, error: `Erro na correção via IA: ${JSON.stringify(detalhe)}` });
  }

  // Identifica ou cria o aluno a partir dos dados lidos no cabeçalho
  let aluno_id = null;
  const dados = resultado.dados_aluno || {};
  if (dados.nome) {
    const [existente] = await sql`
      SELECT id FROM alunos
      WHERE prova_id = ${prova_id} AND LOWER(nome) = LOWER(${dados.nome})
      LIMIT 1
    `;
    if (existente) {
      aluno_id = existente.id;
    } else {
      const [novo] = await sql`
        INSERT INTO alunos (prova_id, nome, turma, serie, turno, numero, qr_payload)
        VALUES (${prova_id}, ${dados.nome}, ${dados.turma || null}, ${dados.ano_escolar || null},
                ${dados.modalidade || null}, ${dados.numero || null}, ${JSON.stringify(dados)})
        RETURNING id
      `;
      aluno_id = novo.id;
    }
  }

  const fonte = dados.nome ? 'cabecalho' : 'manual';

  const [correcao] = await sql`
    INSERT INTO correcoes (
      prova_id, aluno_id, qrcode_lido, qrcode_valido, fonte_identificacao,
      respostas_aluno, correcao_questoes, resultado_secoes,
      total_acertos, nota, status, observacoes
    ) VALUES (
      ${prova_id}, ${aluno_id}, ${!!dados.nome}, ${!!dados.nome}, ${fonte},
      ${JSON.stringify(resultado.respostas_aluno)},
      ${JSON.stringify(resultado.correcao_questoes)},
      ${JSON.stringify(resultado.resultado_secoes)},
      ${resultado.total_acertos}, ${resultado.nota}, ${resultado.status},
      ${JSON.stringify(resultado.observacoes || [])}
    ) RETURNING *
  `;

  return res.status(201).json({ data: correcao, error: null });
}

export default withAuth(handler);
