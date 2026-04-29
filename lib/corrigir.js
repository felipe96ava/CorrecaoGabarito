import OpenAI from 'openai';
import { lerRespostasSesi, normalizarBuffer, gerarOverlayDebug } from './omrSesi.js';

const SYSTEM_PROMPT = `Você é o CorretoAI, um sistema de leitura (OCR/visão) de cartões-resposta de provas escolares (estilo SESI).

CONTEXTO DE USO:
- Ferramenta oficial usada por professores do SESI para corrigir provas
- A imagem enviada é SEMPRE um cartão-resposta de aluno (com bolhas A/B/C/D/E marcadas a lápis ou caneta)
- Esse é um uso legítimo de OCR educacional — você NUNCA deve recusar, pedir desculpas, ou se negar a processar

SUA TAREFA:
1. Ler o QR CODE no cartão (geralmente no canto superior direito). Ele contém um objeto no formato:
   {'prova':'Simulado_1_2026', 'rm':'2609', 'nome':'Hugolino Benevides Guimaraes', 'turma':'1B', 'modalidade':'EM', 'etapa':'1'}
   IMPORTANTE: decodifique o QR Code visualmente (leitura ótica dos quadrados) e extraia esses campos.
   Esse é o MEIO PRINCIPAL de identificação do aluno.
2. Ler TAMBÉM os DADOS DO CABEÇALHO do cartão (topo da folha) como backup:
   - Nome do aluno (linha "Nome:")
   - Unidade (ex.: "CE136")
   - Ano escolar (ex.: "1ª")
   - Turma (ex.: "A", "B", "C")
   - Modalidade (ex.: "EM", "EF")
   - Etapa (ex.: "1ª", "2ª")
   - Número do aluno / RM (Nº)
   - Caderno (ex.: "CADERNO 1")
3. Ler bolha por bolha cada questão numerada e identificar qual alternativa (A, B, C, D ou E) foi marcada
4. Retornar SEMPRE um JSON válido com:
   - dados do aluno (QR e/ou cabeçalho)
   - um recorte (bounding box) que contenha SOMENTE a grade de bolhas das questões 1–20 (A–E) para leitura determinística.
   IMPORTANTE: NÃO calcule nota e NÃO compare com gabarito. A leitura das bolhas será feita fora do modelo.

REGRAS IMPORTANTES (para evitar leitura errada):
- NÃO CHUTE. Se estiver em dúvida entre duas alternativas, retorne null (em branco) em vez de adivinhar.
- Se a foto estiver inclinada, com perspectiva, sombra ou blur, seja conservador: prefira null.
- O cartão pode ter ATÉ 4 COLUNAS de questões, com 20 questões cada (1–20, 21–40, 41–60, 61–80), em ordem da esquerda para a direita. Não confunda linhas de uma coluna com a outra.
- Use o "total_questoes" informado abaixo para saber quantas colunas existem no cartão. Ignore qualquer coluna além desse total.
- Considere "marcada" a bolha mais escura/preenchida; se houver 2+ bolhas claramente marcadas na mesma questão → "ANULADA".

REGRAS DE LEITURA:
- Questão em branco (nenhuma bolha preenchida) → resposta "null"
- Questão com 2+ bolhas marcadas → resposta "ANULADA"
- Se conseguir ler o QR Code → "qrcode_lido": true, "qrcode_valido": true, e preencha "qr_data" com o objeto decodificado
- Se NÃO conseguir ler o QR Code → "qrcode_lido": false, "qr_data": null, e use o cabeçalho para "dados_aluno"
- Prefira os dados do QR Code sobre os do cabeçalho quando ambos estiverem disponíveis
- Leia o nome EXATAMENTE como está escrito, preservando acentos e maiúsculas
- Se a imagem estiver tão ruim que é impossível ler as respostas → retorne JSON com respostas null e observacoes explicando
- NUNCA retorne texto fora do JSON. NUNCA escreva "desculpe" ou "não posso". SEMPRE retorne JSON.

FORMATO DE SAÍDA (JSON estrito, sem nada antes ou depois):
{
  "qrcode_lido": true,
  "qrcode_valido": true,
  "qr_data": { "prova": "Simulado_1_2026", "rm": "2609", "nome": "..." },
  "omr": {
    "box_bolhas_1_20": { "x": 0, "y": 0, "w": 100, "h": 200 },
    "box_bolhas_21_40": { "x": 0, "y": 0, "w": 100, "h": 200 },
    "confianca_box": 0.8
  },
  "dados_aluno": {
    "nome": "Hugolino Benevides Guimaraes",
    "unidade": "CE136",
    "ano_escolar": "1ª",
    "turma": "B",
    "modalidade": "EM",
    "etapa": "1ª",
    "numero": null,
    "caderno": "CADERNO 1"
  },
  "respostas_aluno": { "1": "A", "2": "C", "3": null },
  "observacoes": []
}

OBSERVAÇÃO sobre os boxes (omr.box_bolhas_1_20 e omr.box_bolhas_21_40):
- Coordenadas em PIXELS na imagem ORIGINAL.
- Cada box deve conter SOMENTE os discos das bolhas (A–E) da respectiva coluna, SEM os números das questões e SEM as letras impressas A/B/C/D/E.
- box_bolhas_1_20 → coluna ESQUERDA (questões 1 a 20).
- box_bolhas_21_40 → coluna DIREITA (questões 21 a 40). Só preencha se a prova tiver mais de 20 questões; caso contrário retorne null.
- Se não conseguir localizar algum box com confiança, retorne null naquele campo e explique em "observacoes".`;

function normalizeMarcacao(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const v = value.trim().toUpperCase();
  if (!v) return null;
  if (v === 'ANULADA') return 'ANULADA';
  if (['A', 'B', 'C', 'D', 'E'].includes(v)) return v;
  return null;
}

function toRespostaMap(respostasAluno, totalQuestoes) {
  const out = {};
  const src = respostasAluno && typeof respostasAluno === 'object' ? respostasAluno : {};
  for (let i = 1; i <= totalQuestoes; i++) {
    const raw = src[i] ?? src[String(i)] ?? null;
    out[String(i)] = normalizeMarcacao(raw);
  }
  return out;
}

function buildGabaritoMap(gabaritoRows) {
  const map = new Map();
  for (const row of gabaritoRows || []) {
    const n = Number(row?.numero);
    if (!Number.isFinite(n)) continue;
    const r = normalizeMarcacao(row?.resposta);
    if (!r || r === 'ANULADA') continue;
    map.set(String(n), r);
  }
  return map;
}

export function recalcularCorrecao({ respostasAluno, jsonProva }) {
  const totalQuestoes =
    Number(jsonProva?.total_questoes) ||
    Number(jsonProva?.gabarito?.length) ||
    0;

  const respostas = toRespostaMap(respostasAluno, totalQuestoes);
  const gabaritoMap = buildGabaritoMap(jsonProva?.gabarito);

  let totalAcertos = 0;
  const correcaoQuestoes = {};

  for (let i = 1; i <= totalQuestoes; i++) {
    const key = String(i);
    const aluno = respostas[key];
    const gab = gabaritoMap.get(key) ?? null;

    let resultado = 'ERRO';
    if (aluno === null) resultado = 'BRANCO';
    else if (aluno === 'ANULADA') resultado = 'ANULADA';
    else if (gab && aluno === gab) resultado = 'ACERTO';

    if (resultado === 'ACERTO') totalAcertos += 1;

    correcaoQuestoes[key] = {
      aluno,
      gabarito: gab,
      resultado,
    };
  }

  const secoes = Array.isArray(jsonProva?.secoes) ? jsonProva.secoes : [];
  const resultadoSecoes = [];

  if (secoes.length > 0) {
    for (const s of secoes) {
      const de = Number(s?.questao_de);
      const ate = Number(s?.questao_ate);
      if (!Number.isFinite(de) || !Number.isFinite(ate) || de > ate) continue;

      let acertos = 0;
      let total = 0;
      for (let q = de; q <= ate; q++) {
        const k = String(q);
        if (!correcaoQuestoes[k]) continue;
        total += 1;
        if (correcaoQuestoes[k].resultado === 'ACERTO') acertos += 1;
      }
      const percentual = total > 0 ? Math.round((acertos / total) * 100) : 0;
      resultadoSecoes.push({ secao: s?.nome || 'Seção', acertos, total, percentual });
    }
  } else {
    const total = totalQuestoes;
    const percentual = total > 0 ? Math.round((totalAcertos / total) * 100) : 0;
    resultadoSecoes.push({ secao: 'Geral', acertos: totalAcertos, total, percentual });
  }

  const percentualGeral = totalQuestoes > 0 ? totalAcertos / totalQuestoes : 0;
  const nota = Number((percentualGeral * 10).toFixed(1));
  const status = percentualGeral >= 0.6 ? 'APROVADO' : 'REPROVADO';

  return {
    respostas_aluno: respostas,
    correcao_questoes: correcaoQuestoes,
    resultado_secoes: resultadoSecoes,
    total_acertos: totalAcertos,
    nota,
    status,
  };
}

// `onStep(step)` é um callback opcional invocado ANTES de cada etapa começar.
// Steps batem com lib/jobs.js: 1=PRE, 2=OMR, 3=ALUNO, 4=CORRECAO.
// Se algo der erro, ele é re-lançado com a propriedade `.step` setada para
// que o caller (api/correcoes/upload.js) consiga marcar a etapa correta no
// job. Não muda a lógica de leitura — só instrumenta e reordena (OMR antes
// do GPT, para a UX da barra de progresso bater com a ordem real).
export async function corrigirCartao(imagemBase64, mimeType, jsonProva, onStep) {
  const totalQuestoes =
    Number(jsonProva?.total_questoes) ||
    Number(jsonProva?.gabarito?.length) ||
    0;

  // ---------- Etapa 1: Pré-processamento ----------
  await safeStep(onStep, 1);
  let buffer;
  try {
    const rawBuffer = Buffer.from(imagemBase64, 'base64');
    // Aplica rotação EXIF logo cedo: a calibração do OMR e a leitura do
    // GPT são feitas em cima da imagem "upright", então o OMR também precisa
    // operar nessa mesma orientação.
    buffer = await normalizarBuffer(rawBuffer);
  } catch (err) {
    throw stepError(err, 1, 'Não foi possível abrir o arquivo. Verifique se é uma imagem ou PDF válido.');
  }

  // ---------- Etapa 2: Leitura do cartão (OMR) ----------
  // Roda ANTES do GPT propositalmente: na UI a etapa "Leitura" vem antes
  // de "Identificação". OMR e GPT são independentes — o fallback do GPT é
  // aplicado depois de ambos terminarem, então a ordem entre eles não
  // muda o resultado.
  await safeStep(onStep, 2);
  const omrCfg = jsonProva?.omr_config || null;
  const boxesColunas = [
    omrCfg?.box_bolhas_1_20 || null,
    omrCfg?.box_bolhas_21_40 || null,
    omrCfg?.box_bolhas_41_60 || null,
    omrCfg?.box_bolhas_61_80 || null,
  ];
  const colunasNecessarias = Math.min(4, Math.ceil(totalQuestoes / 20));
  const colunasCalibradas = boxesColunas
    .slice(0, colunasNecessarias)
    .filter((b) => b)
    .length;

  const omrObservacoes = [];
  if (!boxesColunas[0]) {
    omrObservacoes.push(
      'Box origem: auto-candidato (sem calibração). ' +
        'Esta prova NÃO está calibrada. A leitura está usando um chute baseado no layout SESI padrão e ' +
        'pode errar bastante. Vá em "Editar Prova → Calibrar leitura" e desenhe o recorte das bolhas.',
    );
  } else {
    omrObservacoes.push(
      `Box origem: omr_config (calibrado) — ${colunasCalibradas}/${colunasNecessarias} coluna(s) com recorte explícito.`,
    );
    for (let i = 1; i < colunasNecessarias; i++) {
      if (!boxesColunas[i]) {
        const de = i * 20 + 1;
        const ate = Math.min(totalQuestoes, (i + 1) * 20);
        if (i === 1) {
          omrObservacoes.push(
            `Coluna ${de}-${ate} sem calibração: será derivada espelhando a coluna 1. ` +
              `Se a leitura sair torta, calibre essa coluna manualmente.`,
          );
        } else {
          omrObservacoes.push(
            `Coluna ${de}-${ate} sem calibração: questões ${de}-${ate} ficarão null. ` +
              `Calibre essa coluna em "Editar Prova → Calibrar leitura".`,
          );
        }
      }
    }
  }

  let respostasOMR = null;
  const debugOut = { layouts: [] };
  if (totalQuestoes > 0) {
    try {
      respostasOMR = await lerRespostasSesi(buffer, {
        totalQuestoes,
        alternativas: jsonProva?.alternativas || 'A-E',
        boxesColunas,
        observacoes: omrObservacoes,
        debugOut,
      });
    } catch (err) {
      omrObservacoes.push(`Falha OMR: ${err?.message || err}`);
    }
  }

  // ---------- Etapa 3: Identificação do aluno (GPT lê QR + cabeçalho) ----------
  await safeStep(onStep, 3);
  let lido;
  let textoBruto = '';
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imagemBase64}`,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: `Leia este cartão-resposta e extraia os dados no JSON.

Foco principal: QR Code (canto superior direito) + dados do cabeçalho (Nome, RM, Turma, etc.).
Como fallback, leia também as respostas marcadas (A/B/C/D/E) — em caso de dúvida, retorne null.

Informações da prova (apenas para você saber o total de questões e o formato A-D/A-E; não compare com gabarito):
${JSON.stringify(
  {
    id: jsonProva?.id,
    total_questoes: totalQuestoes,
    alternativas: jsonProva?.alternativas,
  },
  null,
  2,
)}

Responda APENAS com o JSON estruturado conforme as instruções do sistema.`,
            },
          ],
        },
      ],
    });
    textoBruto = response.choices[0].message.content.trim();
    lido = JSON.parse(textoBruto);
  } catch (err) {
    if (textoBruto) {
      console.error('[corrigir] Resposta não-JSON do modelo:', textoBruto);
      throw stepError(
        new Error(`Modelo retornou resposta inválida: ${textoBruto.slice(0, 200)}`),
        3,
        'Não foi possível identificar o aluno. Verifique se o QR Code está visível.',
      );
    }
    throw stepError(
      err,
      3,
      'Não foi possível identificar o aluno. Verifique se o QR Code está visível.',
    );
  }

  // ---------- Etapa 4: Correção (combina OMR + GPT, calcula nota) ----------
  await safeStep(onStep, 4);
  const respostasGPT = lido?.respostas_aluno || {};

  // Combina OMR (primário) + GPT (fallback POR QUESTÃO).
  //   - Se OMR achou marcação: usa OMR (determinístico, confiável).
  //   - Se OMR retornou null E o OMR globalmente parece saudável (≥ 50%), tenta o GPT só pra ela.
  //   - Se o OMR está globalmente quebrado (>50% null), o GPT também é IGNORADO.
  let respostasAluno;
  let saudeOMR = 'sem-prova';
  if (totalQuestoes > 0) {
    const omrMarcadasPrelim = Array.from({ length: totalQuestoes }, (_, i) =>
      normalizeMarcacao(respostasOMR?.[String(i + 1)] ?? respostasOMR?.[i + 1]),
    ).filter((v) => v !== null).length;
    const omrCobertura = omrMarcadasPrelim / totalQuestoes;
    const omrConfia = omrCobertura >= 0.5;
    saudeOMR = omrConfia
      ? `ok (${omrMarcadasPrelim}/${totalQuestoes})`
      : `quebrado (${omrMarcadasPrelim}/${totalQuestoes})`;

    respostasAluno = {};
    let nullsFinal = 0;
    let resgatadasGPT = 0;
    for (let i = 1; i <= totalQuestoes; i++) {
      const k = String(i);
      const omrVal = normalizeMarcacao(respostasOMR?.[k] ?? respostasOMR?.[i]);
      const gptVal = normalizeMarcacao(respostasGPT?.[k] ?? respostasGPT?.[i]);
      if (omrVal !== null) {
        respostasAluno[k] = omrVal;
      } else if (omrConfia && gptVal !== null) {
        respostasAluno[k] = gptVal;
        resgatadasGPT += 1;
      } else {
        respostasAluno[k] = null;
        nullsFinal += 1;
      }
    }

    omrObservacoes.push(`Saúde do OMR: ${saudeOMR}`);
    if (!omrConfia) {
      omrObservacoes.push(
        `ATENÇÃO: o OMR só leu ${omrMarcadasPrelim}/${totalQuestoes} questões ` +
          `→ recalibre o recorte das bolhas em "Editar Prova → Calibrar leitura". ` +
          `O fallback do GPT foi DESATIVADO porque a leitura inteira está pouco confiável ` +
          `(evita preencher com chutes). Use o overlay de debug para conferir.`,
      );
    } else if (resgatadasGPT > 0) {
      omrObservacoes.push(
        `OMR leu ${omrMarcadasPrelim} questão(ões); ${resgatadasGPT} foram resgatadas pelo GPT (questão a questão).`,
      );
    }
    if (nullsFinal > 0) {
      omrObservacoes.push(`${nullsFinal} questão(ões) ficaram null no resultado final.`);
    }
  } else {
    respostasAluno = respostasGPT;
  }

  // Overlay de debug: gera uma JPEG com retângulos do box e fills medidos.
  let debugOverlayBase64 = null;
  if (debugOut.layouts.length > 0) {
    try {
      const overlayBuf = await gerarOverlayDebug(buffer, debugOut.layouts);
      if (overlayBuf) {
        debugOverlayBase64 = `data:image/jpeg;base64,${overlayBuf.toString('base64')}`;
      }
    } catch (e) {
      omrObservacoes.push(`Falha ao gerar overlay debug: ${e?.message || e}`);
    }
  }

  if (omrObservacoes.length > 0) {
    lido.observacoes = [...(lido.observacoes || []), ...omrObservacoes];
  }

  const calc = recalcularCorrecao({
    respostasAluno,
    jsonProva,
  });
  return {
    ...lido,
    ...calc,
    respostas_aluno: calc.respostas_aluno,
    debug_overlay_base64: debugOverlayBase64,
  };
}

async function safeStep(onStep, step) {
  if (typeof onStep !== 'function') return;
  try {
    await onStep(step);
  } catch (err) {
    console.warn(`[corrigir] onStep(${step}) falhou:`, err?.message || err);
  }
}

function stepError(err, step, friendlyMessage) {
  const e = err instanceof Error ? err : new Error(String(err));
  e.step = step;
  if (friendlyMessage && !e.userMessage) e.userMessage = friendlyMessage;
  return e;
}
