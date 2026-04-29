import { neon } from '@neondatabase/serverless';
import formidable from 'formidable';
import fs from 'fs';
import sharp from 'sharp';
import { withAuth } from '../../lib/middleware.js';
import { corrigirCartao } from '../../lib/corrigir.js';
import { updateJob, STATUS, STEP } from '../../lib/jobs.js';

export const config = { api: { bodyParser: false } };

// Mensagem amigável por etapa quando falhamos sem ter mensagem explícita.
const FALLBACK_BY_STEP = {
  [STEP.PRE]: 'Não foi possível abrir o arquivo. Tente outra imagem ou PDF.',
  [STEP.OMR]: 'Não foi possível ler as marcações. Tente uma foto mais nítida e bem alinhada.',
  [STEP.ALUNO]: 'Não foi possível identificar o aluno. Verifique se o QR Code está visível.',
  [STEP.CORRECAO]: 'Falha ao calcular a correção. Tente novamente.',
};

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ data: null, error: 'Método não permitido' });
  }

  const sql = neon(process.env.DATABASE_URL);
  const form = formidable({ maxFileSize: 4.5 * 1024 * 1024 });
  let fields, files;
  try {
    [fields, files] = await form.parse(req);
  } catch {
    return res.status(400).json({ data: null, error: 'Erro ao processar o arquivo enviado' });
  }

  const prova_id = fields.prova_id?.[0];
  const job_id = fields.job_id?.[0] || null;
  if (!prova_id) {
    return res.status(400).json({ data: null, error: 'prova_id é obrigatório' });
  }

  const arquivo = files.arquivo?.[0];
  if (!arquivo) {
    return res.status(400).json({ data: null, error: 'Arquivo não enviado' });
  }

  // Confirma que o job pertence ao usuário (se foi passado).
  if (job_id) {
    const [j] = await sql`SELECT id FROM correcao_jobs WHERE id = ${job_id} AND user_id = ${req.user.id}`;
    if (!j) {
      return res.status(404).json({ data: null, error: 'Job não encontrado' });
    }
    await updateJob(sql, job_id, { step: STEP.PRE, status: STATUS.PROCESSING });
  }

  let etapaAtual = STEP.PRE;

  try {
    const [prova] = await sql`SELECT * FROM provas WHERE id = ${prova_id} AND user_id = ${req.user.id}`;
    if (!prova) {
      throw stepError(new Error('Prova não encontrada'), STEP.PRE);
    }

    const secoes = await sql`SELECT * FROM secoes WHERE prova_id = ${prova_id} ORDER BY ordem`;
    const gabarito = await sql`SELECT * FROM gabarito WHERE prova_id = ${prova_id} ORDER BY numero`;
    const [omr_config] = await sql`SELECT * FROM omr_config WHERE prova_id = ${prova_id}`;
    const jsonProva = { ...prova, secoes, gabarito, omr_config: omr_config || null };

    const buffer = fs.readFileSync(arquivo.filepath);
    const imagemBase64 = buffer.toString('base64');
    const mimeType = arquivo.mimetype || 'image/jpeg';

    const onStep = async (step) => {
      etapaAtual = step;
      if (job_id) await updateJob(sql, job_id, { step, status: STATUS.PROCESSING });
    };

    let resultado;
    try {
      resultado = await corrigirCartao(imagemBase64, mimeType, jsonProva, onStep);
    } catch (err) {
      const stepDoErro = Number.isFinite(err?.step) ? err.step : etapaAtual;
      const detalhe = err?.userMessage || err?.message || 'Erro desconhecido';
      console.error(
        '[upload] Falha em corrigirCartao (step=' + stepDoErro + '):',
        err?.response?.data ?? err?.error ?? err?.stack ?? err?.message,
      );
      throw stepError(new Error(detalhe), stepDoErro);
    }

    // Comprime e converte para JPEG (data URL) para que o cartão fique acessível
    // depois (recalibração / auditoria visual). Sem isso, arquivo_url ficava null.
    let arquivoUrl = null;
    try {
      const compressed = await sharp(buffer)
        .rotate()
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer();
      arquivoUrl = `data:image/jpeg;base64,${compressed.toString('base64')}`;
    } catch (e) {
      console.warn('[upload] Falha ao comprimir cartão para storage:', e?.message || e);
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
    const arquivoDebugUrl = resultado.debug_overlay_base64 || null;

    const [correcao] = await sql`
      INSERT INTO correcoes (
        prova_id, aluno_id, arquivo_url, arquivo_debug_url,
        qrcode_lido, qrcode_valido, fonte_identificacao,
        respostas_aluno, correcao_questoes, resultado_secoes,
        total_acertos, nota, status, observacoes
      ) VALUES (
        ${prova_id}, ${aluno_id}, ${arquivoUrl}, ${arquivoDebugUrl},
        ${!!resultado.qrcode_lido}, ${!!resultado.qrcode_valido}, ${fonte},
        ${JSON.stringify(resultado.respostas_aluno)},
        ${JSON.stringify(resultado.correcao_questoes)},
        ${JSON.stringify(resultado.resultado_secoes)},
        ${resultado.total_acertos}, ${resultado.nota}, ${resultado.status},
        ${JSON.stringify(resultado.observacoes || [])}
      ) RETURNING *
    `;

    if (job_id) {
      await updateJob(sql, job_id, {
        step: STEP.DONE,
        status: STATUS.DONE,
        correcao_id: correcao.id,
      });
    }

    return res.status(201).json({ data: correcao, job_id, error: null });
  } catch (err) {
    const stepDoErro = Number.isFinite(err?.step) ? err.step : etapaAtual;
    const userMessage =
      err?.userMessage ||
      (err?.message && !/^Error:/.test(err.message) ? err.message : null) ||
      FALLBACK_BY_STEP[stepDoErro] ||
      'Falha ao processar o cartão. Tente novamente.';

    if (job_id) {
      await updateJob(sql, job_id, {
        step: stepDoErro,
        status: STATUS.ERROR,
        error_message: userMessage,
      });
    }
    return res.status(422).json({ data: null, job_id, error: userMessage });
  }
}

function stepError(err, step) {
  const e = err instanceof Error ? err : new Error(String(err));
  e.step = step;
  return e;
}

export default withAuth(handler);
