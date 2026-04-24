import OpenAI from 'openai';
import { lerRespostasSesi } from './omrSesi.js';

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
- O cartão costuma ter DUAS COLUNAS de questões (ex.: 1–20 na esquerda e 21–40 na direita). Não confunda linhas de uma coluna com a outra.
- Se o total de questões informado for 20, leia SOMENTE as questões 1–20 e ignore 21+.
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

export async function corrigirCartao(imagemBase64, mimeType, jsonProva) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const totalQuestoes =
    Number(jsonProva?.total_questoes) ||
    Number(jsonProva?.gabarito?.length) ||
    0;

  const buffer = Buffer.from(imagemBase64, 'base64');

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

Além do QR/cabeçalho, você DEVE retornar bounding boxes (coordenadas em PIXELS na imagem ORIGINAL) cobrindo SOMENTE a grade de bolhas (A–E; sem números e sem letras impressas):
- "omr.box_bolhas_1_20"  → coluna esquerda (questões 1 a 20). SEMPRE preencha.
- "omr.box_bolhas_21_40" → coluna direita (questões 21 a 40). Preencha APENAS se a prova tiver mais de 20 questões; caso contrário, retorne null.

Se não conseguir localizar com segurança algum dos boxes, coloque null naquele campo e explique em "observacoes".

Informações da prova (apenas para você saber o total de questões e o formato A-D/A-E; não compare com gabarito):
${JSON.stringify(
  {
    id: jsonProva?.id,
    total_questoes: totalQuestoes,
    alternativas: jsonProva?.alternativas,
  },
  null,
  2
)}

Responda APENAS com o JSON estruturado conforme as instruções do sistema.`,
          },
        ],
      },
    ],
  });

  const texto = response.choices[0].message.content.trim();
  try {
    const lido = JSON.parse(texto);

    // 1) Leitura determinística das bolhas (todas as questões). Usa box(es) do omr_config
    //    (calibração por prova) com prioridade; senão usa os boxes retornados pelo modelo;
    //    senão tenta auto-detecção com candidatos padrão.
    let respostasAluno = lido?.respostas_aluno;
    const boxCol1 =
      jsonProva?.omr_config?.box_bolhas_1_20 || lido?.omr?.box_bolhas_1_20 || null;
    const boxCol2 =
      jsonProva?.omr_config?.box_bolhas_21_40 || lido?.omr?.box_bolhas_21_40 || null;

    const omrObservacoes = [];
    if (totalQuestoes > 0) {
      try {
        const respostasOMR = await lerRespostasSesi(buffer, {
          totalQuestoes,
          alternativas: jsonProva?.alternativas || 'A-E',
          boxBolhas: boxCol1,
          boxBolhas2140: boxCol2,
          observacoes: omrObservacoes,
        });
        respostasAluno = respostasOMR;
      } catch (err) {
        omrObservacoes.push(`Falha OMR: ${err?.message || err}`);
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
    };
  } catch (err) {
    console.error('[corrigir] Resposta não-JSON do modelo:', texto);
    throw new Error(`Modelo retornou resposta inválida: ${texto.slice(0, 200)}`);
  }
}
