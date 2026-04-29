import sharp from 'sharp';

const DEBUG = process.env.OMR_DEBUG === '1';

// Decisão por GAP entre alternativas da própria questão.
// O motivo: cartões SESI têm letra (A, B, C, D, E) impressa dentro de cada
// bolha + contorno do círculo, então toda bolha vazia já vem com 40-60% de
// fill no scan, e esse "fundo" varia entre questões (sombra, alinhamento).
// Threshold absoluto não funciona; threshold sobre lift contra mediana fica
// preso na precisão decimal (Q17 = 17.98pp, Q5 = 16.5pp; a fronteira fica
// instável). Em vez disso usamos os GAPS entre as 5 bolhas ordenadas:
//   gapTop = fill_da_1ª − fill_da_2ª
//   gap2nd = fill_da_2ª − fill_da_3ª
// Uma marca real do aluno destaca UMA bolha do resto (gapTop ≥ MIN_GAP).
// Duas marcas reais (ANULADA) destacam DUAS bolhas: gapTop pequeno, mas
// gap2nd grande. Caso contrário (todas no mesmo nível), é ruído → null.
const MIN_GAP = 0.10;                // 10 pp separa "destaque" de "fundo"

// Parâmetros de binarização adaptativa.
const ADAPTIVE_C = 10;               // subtraído da média local antes de comparar

function dbg(...args) {
  if (DEBUG) console.log('[OMR]', ...args);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function sanitizeBox(box, imageWidth, imageHeight) {
  const isRatio =
    box?.unit === 'ratio' ||
    (box &&
      typeof box.x === 'number' &&
      typeof box.y === 'number' &&
      typeof box.w === 'number' &&
      typeof box.h === 'number' &&
      box.x >= 0 &&
      box.y >= 0 &&
      box.w > 0 &&
      box.h > 0 &&
      box.x <= 1 &&
      box.y <= 1 &&
      box.w <= 1 &&
      box.h <= 1);

  const px = isRatio ? box.x * imageWidth : box.x;
  const py = isRatio ? box.y * imageHeight : box.y;
  const pw = isRatio ? box.w * imageWidth : box.w;
  const ph = isRatio ? box.h * imageHeight : box.h;

  const x = clamp(Math.round(px), 0, imageWidth - 1);
  const y = clamp(Math.round(py), 0, imageHeight - 1);
  const w = clamp(Math.round(pw), 1, imageWidth - x);
  const h = clamp(Math.round(ph), 1, imageHeight - y);
  return { x, y, w, h };
}

async function extractGrayRaw(buffer, box, targetWidth = 900) {
  const crop = sharp(buffer)
    .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
    .resize({
      width: targetWidth,
      height: Math.max(1, Math.round((targetWidth * box.h) / box.w)),
      fit: 'fill',
    })
    .greyscale()
    .normalize();
  const { data, info } = await crop.raw().toBuffer({ resolveWithObject: true });
  return { data, info };
}

// Imagem integral para somas de retângulo em O(1).
function buildIntegralImage(data, info) {
  const W = info.width;
  const H = info.height;
  const ii = new Float64Array(W * H);
  for (let y = 0; y < H; y++) {
    let rowSum = 0;
    for (let x = 0; x < W; x++) {
      rowSum += data[y * W + x];
      ii[y * W + x] = rowSum + (y > 0 ? ii[(y - 1) * W + x] : 0);
    }
  }
  return ii;
}

// Binarização adaptativa (limiar = média local - C). 1 = pixel escuro (tinta).
function adaptiveThreshold(data, info, ii, window, C) {
  const W = info.width;
  const H = info.height;
  const bin = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - window);
    const y1 = Math.min(H - 1, y + window);
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - window);
      const x1 = Math.min(W - 1, x + window);
      const sum =
        ii[y1 * W + x1] -
        (x0 > 0 ? ii[y1 * W + (x0 - 1)] : 0) -
        (y0 > 0 ? ii[(y0 - 1) * W + x1] : 0) +
        (x0 > 0 && y0 > 0 ? ii[(y0 - 1) * W + (x0 - 1)] : 0);
      const count = (y1 - y0 + 1) * (x1 - x0 + 1);
      const local = sum / count;
      bin[y * W + x] = data[y * W + x] < local - C ? 1 : 0;
    }
  }
  return bin;
}

// Proporção de pixels marcados (escuros) dentro de um disco de raio r centrado em (cx, cy).
function fillRatioInDisc(bin, info, cx, cy, r) {
  const W = info.width;
  const H = info.height;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(H - 1, Math.ceil(cy + r));
  const r2 = r * r;
  let total = 0;
  let dark = 0;
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      if (dx * dx + dy * dy <= r2) {
        total++;
        if (bin[y * W + x]) dark++;
      }
    }
  }
  return total > 0 ? dark / total : 0;
}

function decideFromFills(fills, alts) {
  if (!fills || fills.length === 0) return null;

  const sorted = fills
    .map((v, idx) => ({ v, idx }))
    .sort((a, b) => b.v - a.v);
  const best = sorted[0];
  const second = sorted[1] || { v: 0, idx: -1 };
  const third = sorted[2] || { v: 0, idx: -1 };

  const gapTop = best.v - second.v;
  const gap2nd = second.v - third.v;

  // 1ª claramente destacada da 2ª → marca limpa.
  if (gapTop >= MIN_GAP) return alts[best.idx] || null;

  // 1ª e 2ª colaram, mas a 2ª está bem acima da 3ª → duas marcas reais → ANULADA.
  if (gap2nd >= MIN_GAP) return 'ANULADA';

  // Tudo no mesmo nível: ruído ou bolha vazia → branco.
  return null;
}

function scoreRespostas(respostas) {
  const vals = Object.values(respostas || {});
  const marcadas = vals.filter((v) => v && v !== 'ANULADA').length;
  const anuladas = vals.filter((v) => v === 'ANULADA').length;
  const nulas = vals.filter((v) => v === null).length;
  return marcadas * 2 - anuladas * 3 - nulas * 0.2;
}

async function readGrid(buffer, box, opts) {
  const { questoesDe, questoesAte, alts, imgW, imgH, observacoes, label, debugOut } = opts;
  const safeBox = sanitizeBox(box, imgW, imgH);
  const { data, info } = await extractGrayRaw(buffer, safeBox);

  const rows = questoesAte - questoesDe + 1;
  const cols = alts.length;
  const rowH = info.height / rows;
  const colW = info.width / cols;
  const r = Math.max(3, Math.min(rowH, colW) * 0.28);
  const window = Math.max(8, Math.round(Math.min(rowH, colW) * 0.9));

  dbg(
    `${label} box(px originais): x=${safeBox.x} y=${safeBox.y} w=${safeBox.w} h=${safeBox.h}`,
  );
  dbg(
    `${label} crop ${info.width}x${info.height} | rows=${rows} cols=${cols} | rowH=${rowH.toFixed(
      1,
    )} colW=${colW.toFixed(1)} r=${r.toFixed(1)} window=${window}`,
  );

  const ii = buildIntegralImage(data, info);
  const bin = adaptiveThreshold(data, info, ii, window, ADAPTIVE_C);

  const respostas = {};
  const fills2D = [];
  const respostasArr = [];
  for (let i = 0; i < rows; i++) {
    const q = questoesDe + i;
    const cy = (i + 0.5) * rowH;
    const fills = [];
    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.5) * colW;
      fills.push(fillRatioInDisc(bin, info, cx, cy, r));
    }
    const answer = decideFromFills(fills, alts);
    respostas[String(q)] = answer;
    fills2D.push(fills);
    respostasArr.push(answer);

    // Calcula gaps para diagnóstico (mesmo cálculo do decideFromFills).
    const sortedDescV = [...fills].sort((a, b) => b - a);
    const gapTop = (sortedDescV[0] ?? 0) - (sortedDescV[1] ?? 0);
    const gap2nd = (sortedDescV[1] ?? 0) - (sortedDescV[2] ?? 0);

    const summary = `Q${q} ${fills
      .map((f, idx) => `${alts[idx]}=${(f * 100).toFixed(0)}%`)
      .join(' ')} (gapTop=${(gapTop * 100).toFixed(0)}pp gap2nd=${(gap2nd * 100).toFixed(0)}pp) -> ${answer ?? 'null'}`;
    dbg(summary);
    if (Array.isArray(observacoes)) observacoes.push(summary);
  }

  if (debugOut && Array.isArray(debugOut.layouts)) {
    debugOut.layouts.push({
      box: safeBox,
      rows,
      cols,
      alts,
      fills2D,
      respostas: respostasArr,
      questoesDe,
      label,
    });
  }

  return respostas;
}

export async function normalizarBuffer(buffer) {
  // Aplica rotação EXIF e devolve um buffer "upright". Essencial para fotos de
  // celular: sharp.extract() ignora EXIF, então sem normalizar a calibração
  // (feita visualmente sobre a imagem girada) cai em píxeis trocados.
  return sharp(buffer).rotate().toBuffer();
}

// Tamanho máximo de cada bloco/coluna (cartão SESI: 20 questões por coluna).
const QUESTOES_POR_COLUNA = 20;
// Limite atual do sistema: 4 colunas → até 80 questões.
const MAX_COLUNAS = 4;

export async function lerRespostasSesi(
  buffer,
  {
    totalQuestoes,
    alternativas,
    // Novo formato: array de boxes, um por coluna (até MAX_COLUNAS).
    // Aceita null/undefined nas posições não calibradas.
    boxesColunas,
    // Compat antiga (1 ou 2 colunas).
    boxBolhas,
    boxBolhas2140,
    observacoes,
    debugOut,
  },
) {
  if (!totalQuestoes || totalQuestoes < 1) throw new Error('totalQuestoes inválido');

  const alts = alternativas === 'A-D' ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];

  const meta = await sharp(buffer).metadata();
  const imgW = meta.width || 0;
  const imgH = meta.height || 0;
  if (!imgW || !imgH) throw new Error('Não foi possível ler tamanho da imagem');

  // Normaliza os boxes recebidos para um array de tamanho MAX_COLUNAS.
  const boxes = new Array(MAX_COLUNAS).fill(null);
  if (Array.isArray(boxesColunas)) {
    for (let i = 0; i < Math.min(MAX_COLUNAS, boxesColunas.length); i++) {
      boxes[i] = boxesColunas[i] || null;
    }
  }
  if (!boxes[0] && boxBolhas) boxes[0] = boxBolhas;
  if (!boxes[1] && boxBolhas2140) boxes[1] = boxBolhas2140;

  // Quantas colunas a prova realmente usa, com base no total de questões.
  const colunasNecessarias = Math.min(
    MAX_COLUNAS,
    Math.ceil(totalQuestoes / QUESTOES_POR_COLUNA),
  );

  const respostas = {};
  for (let q = 1; q <= totalQuestoes; q++) respostas[String(q)] = null;

  for (let i = 0; i < colunasNecessarias; i++) {
    const questoesDe = i * QUESTOES_POR_COLUNA + 1;
    const questoesAte = Math.min(totalQuestoes, (i + 1) * QUESTOES_POR_COLUNA);
    const labelBase = `Coluna ${questoesDe}-${questoesAte}`;

    let box = boxes[i] || null;
    let derivado = false;

    // Auto-derivação só para a coluna 1 (sem calibração nenhuma) e
    // para a coluna 2 (espelhando a coluna 1). Para 3 e 4, exige calibração
    // explícita — não tem como adivinhar sem mais âncoras.
    if (!box) {
      if (i === 0) {
        const auto = await tentarBoxAutoCol1(buffer, {
          questoesDe,
          questoesAte,
          alts,
          imgW,
          imgH,
          observacoes,
          debugOut,
          label: `${labelBase} (auto)`,
        });
        if (auto) {
          Object.assign(respostas, auto);
        } else if (Array.isArray(observacoes)) {
          observacoes.push(`Auto OMR falhou p/ ${labelBase}.`);
        }
        continue;
      }

      if (i === 1 && boxes[0]) {
        const safe = sanitizeBox(boxes[0], imgW, imgH);
        const novoX = clamp(imgW - safe.x - safe.w, 0, imgW - safe.w - 1);
        box = { x: novoX, y: safe.y, w: safe.w, h: safe.h };
        derivado = true;
        if (Array.isArray(observacoes)) {
          observacoes.push(
            `Box ${questoesDe}-${questoesAte} derivado (espelhado da coluna 1): ` +
              `x=${box.x} y=${box.y} w=${box.w} h=${box.h}`,
          );
        }
      } else {
        if (Array.isArray(observacoes)) {
          observacoes.push(
            `Sem calibração para ${labelBase}; questões ${questoesDe}-${questoesAte} ficarão null. ` +
              `Calibre essa coluna em "Editar Prova → Calibrar leitura".`,
          );
        }
        continue;
      }
    }

    try {
      const r = await readGrid(buffer, box, {
        questoesDe,
        questoesAte,
        alts,
        imgW,
        imgH,
        observacoes,
        label: derivado ? `${labelBase} (derivada)` : labelBase,
        debugOut,
      });
      Object.assign(respostas, r);
    } catch (e) {
      if (Array.isArray(observacoes)) {
        observacoes.push(`Falha ao ler ${labelBase}: ${e?.message || e}`);
      }
    }
  }

  return respostas;
}

async function tentarBoxAutoCol1(
  buffer,
  { questoesDe, questoesAte, alts, imgW, imgH, observacoes, debugOut, label },
) {
  // Sem box calibrado: varre candidatos baseados no layout SESI típico
  // e fica com o de maior score.
  const candidates = [
    { x: imgW * 0.12, y: imgH * 0.60, w: imgW * 0.34, h: imgH * 0.32 },
    { x: imgW * 0.10, y: imgH * 0.58, w: imgW * 0.36, h: imgH * 0.34 },
    { x: imgW * 0.13, y: imgH * 0.62, w: imgW * 0.33, h: imgH * 0.30 },
    { x: imgW * 0.11, y: imgH * 0.56, w: imgW * 0.38, h: imgH * 0.38 },
  ];
  let best = null;
  let bestScore = -Infinity;
  let bestObs = null;
  let bestDebug = null;
  for (const c of candidates) {
    try {
      const scratch = [];
      const scratchDebug = debugOut ? { layouts: [] } : null;
      const r = await readGrid(buffer, c, {
        questoesDe,
        questoesAte,
        alts,
        imgW,
        imgH,
        observacoes: scratch,
        label,
        debugOut: scratchDebug,
      });
      const sc = scoreRespostas(r);
      if (sc > bestScore) {
        bestScore = sc;
        best = r;
        bestObs = scratch;
        bestDebug = scratchDebug;
      }
    } catch {
      // ignora candidato com falha; tenta o próximo
    }
  }
  if (!best) return null;
  if (Array.isArray(observacoes) && Array.isArray(bestObs)) observacoes.push(...bestObs);
  if (debugOut && bestDebug?.layouts?.length) debugOut.layouts.push(...bestDebug.layouts);
  return best;
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]),
  );
}

// Desenha sobre o cartão um overlay com:
//   - retângulo do box que o sistema "achou que eram as bolhas"
//   - círculo em cada centro de bolha (onde o algoritmo MEDIU o preenchimento)
//   - cor: VERDE se foi a marcada; VERMELHA se passou do FILL_THRESHOLD mas
//     não foi escolhida; AMARELA se ficou na zona "fraca"; CINZA se está vazia
//   - rótulo com o % de fill em cada bolha
//   - número da questão e a letra final detectada na lateral
//
// Recebe os "layouts" coletados via opt.debugOut em lerRespostasSesi.
export async function gerarOverlayDebug(buffer, layouts) {
  if (!layouts || layouts.length === 0) return null;
  const meta = await sharp(buffer).metadata();
  const W = meta.width || 0;
  const H = meta.height || 0;
  if (!W || !H) return null;

  const els = [];

  // Legenda no topo
  els.push(
    `<g><rect x="10" y="10" width="430" height="38" fill="rgba(255,255,255,0.92)" stroke="#111" stroke-width="1"/>` +
      `<text x="20" y="34" font-size="16" font-family="sans-serif" fill="#111">` +
      `<tspan fill="#16a34a">●</tspan> escolhida  ` +
      `<tspan fill="#dc2626">●</tspan> ≥40% (não escolhida)  ` +
      `<tspan fill="#f59e0b">●</tspan> 20-40%  ` +
      `<tspan fill="#94a3b8">●</tspan> &lt;20%</text></g>`,
  );

  for (const layout of layouts) {
    const { box, rows, cols, alts, fills2D, respostas, questoesDe, label } = layout;

    els.push(
      `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" ` +
        `fill="rgba(37,99,235,0.06)" stroke="#2563eb" stroke-width="3"/>`,
    );
    els.push(
      `<text x="${box.x + 6}" y="${box.y - 6}" font-size="20" font-family="sans-serif" ` +
        `font-weight="bold" fill="#2563eb">${escapeXml(label)}</text>`,
    );

    const rowH = box.h / rows;
    const colW = box.w / cols;
    const r = Math.max(6, Math.min(rowH, colW) * 0.32);

    for (let i = 0; i < rows; i++) {
      const cy = box.y + (i + 0.5) * rowH;
      const ans = respostas[i];

      const qLabel = `Q${questoesDe + i}: ${ans ?? '—'}`;
      els.push(
        `<text x="${Math.max(2, box.x - 8)}" y="${cy + 5}" font-size="16" ` +
          `font-family="sans-serif" font-weight="bold" text-anchor="end" fill="#111">` +
          `${escapeXml(qLabel)}</text>`,
      );

      for (let c = 0; c < cols; c++) {
        const cx = box.x + (c + 0.5) * colW;
        const fill = fills2D[i][c];
        const isChosen = ans && ans !== 'ANULADA' && alts[c] === ans;
        const isAnulada = ans === 'ANULADA';
        let stroke = '#94a3b8';
        if (isChosen) stroke = '#16a34a';
        else if (isAnulada && fill >= 0.4) stroke = '#7c3aed';
        else if (fill >= 0.4) stroke = '#dc2626';
        else if (fill >= 0.2) stroke = '#f59e0b';
        const sw = isChosen ? 4 : 2;

        els.push(
          `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" ` +
            `fill="none" stroke="${stroke}" stroke-width="${sw}"/>`,
        );
        els.push(
          `<text x="${cx.toFixed(1)}" y="${(cy + r + 14).toFixed(1)}" font-size="${Math.max(
            10,
            Math.round(r * 0.55),
          )}" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="${stroke}">` +
            `${alts[c]}:${(fill * 100).toFixed(0)}</text>`,
        );
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${els.join('')}</svg>`;

  try {
    return await sharp(buffer)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .jpeg({ quality: 75 })
      .toBuffer();
  } catch {
    return null;
  }
}
