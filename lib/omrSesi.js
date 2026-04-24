import sharp from 'sharp';

const DEBUG = process.env.OMR_DEBUG === '1';

// Thresholds de decisão (0..1) para o fill ratio dentro do disco da bolha.
const FILL_THRESHOLD = 0.40;         // fill >= 40% => bolha considerada "marcada"
const WEAK_FILL_THRESHOLD = 0.20;    // fallback p/ marcação fraca (lápis claro)
const RELATIVE_MARGIN = 0.15;        // separação mínima (15 pp) entre 1ª e 2ª

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
  const sorted = fills
    .map((v, idx) => ({ v, idx }))
    .sort((a, b) => b.v - a.v);
  const best = sorted[0];
  const second = sorted[1] || { v: 0, idx: -1 };

  const above = sorted.filter((x) => x.v >= FILL_THRESHOLD);

  // Duas ou mais bolhas passaram do limiar "marcada":
  if (above.length >= 2) {
    // Se estão colados (diferença pequena) → ANULADA.
    if (best.v - second.v < RELATIVE_MARGIN) return 'ANULADA';
    // Se a 1ª é bem dominante → conta a 1ª (evita ANULADA por sujeirinha).
    return alts[best.idx] || null;
  }

  // Exatamente uma passou:
  if (above.length === 1) {
    return alts[best.idx] || null;
  }

  // Nenhuma passou do limiar principal: tenta fallback de marcação fraca.
  if (best.v >= WEAK_FILL_THRESHOLD && best.v - second.v >= RELATIVE_MARGIN) {
    return alts[best.idx] || null;
  }

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
  const { questoesDe, questoesAte, alts, imgW, imgH, observacoes, label } = opts;
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

    const summary = `Q${q} ${fills
      .map((f, idx) => `${alts[idx]}=${(f * 100).toFixed(0)}%`)
      .join(' ')} -> ${answer ?? 'null'}`;
    dbg(summary);
    if (Array.isArray(observacoes)) observacoes.push(summary);
  }
  return respostas;
}

export async function lerRespostasSesi(
  buffer,
  { totalQuestoes, alternativas, boxBolhas, boxBolhas2140, observacoes },
) {
  if (!totalQuestoes || totalQuestoes < 1) throw new Error('totalQuestoes inválido');

  const alts = alternativas === 'A-D' ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];

  const meta = await sharp(buffer).metadata();
  const imgW = meta.width || 0;
  const imgH = meta.height || 0;
  if (!imgW || !imgH) throw new Error('Não foi possível ler tamanho da imagem');

  const col1Ate = Math.min(20, totalQuestoes);
  const col2Quantidade = Math.max(0, totalQuestoes - 20);

  const respostas = {};
  for (let q = 1; q <= totalQuestoes; q++) respostas[String(q)] = null;

  // ---- Coluna 1 (Q1..Q20) ----
  if (boxBolhas) {
    const r1 = await readGrid(buffer, boxBolhas, {
      questoesDe: 1,
      questoesAte: col1Ate,
      alts,
      imgW,
      imgH,
      observacoes,
      label: 'Coluna 1-20',
    });
    Object.assign(respostas, r1);
  } else {
    // Sem box do modelo: varre candidatos e pega o de maior score.
    const candidates = [
      { x: imgW * 0.12, y: imgH * 0.60, w: imgW * 0.34, h: imgH * 0.32 },
      { x: imgW * 0.10, y: imgH * 0.58, w: imgW * 0.36, h: imgH * 0.34 },
      { x: imgW * 0.13, y: imgH * 0.62, w: imgW * 0.33, h: imgH * 0.30 },
      { x: imgW * 0.11, y: imgH * 0.56, w: imgW * 0.38, h: imgH * 0.38 },
    ];
    let best = null;
    let bestScore = -Infinity;
    let bestObs = null;
    let lastErr = null;
    for (const c of candidates) {
      try {
        const scratch = [];
        const r1 = await readGrid(buffer, c, {
          questoesDe: 1,
          questoesAte: col1Ate,
          alts,
          imgW,
          imgH,
          observacoes: scratch,
          label: 'Coluna 1-20 (auto)',
        });
        const sc = scoreRespostas(r1);
        if (sc > bestScore) {
          bestScore = sc;
          best = r1;
          bestObs = scratch;
        }
      } catch (e) {
        lastErr = e;
      }
    }
    if (!best) {
      if (Array.isArray(observacoes)) {
        observacoes.push(`Auto OMR falhou p/ coluna 1-20: ${lastErr?.message || lastErr}`);
      }
    } else {
      Object.assign(respostas, best);
      if (Array.isArray(observacoes) && Array.isArray(bestObs)) observacoes.push(...bestObs);
    }
  }

  // ---- Coluna 2 (Q21..Q40) ----
  if (col2Quantidade > 0) {
    let boxCol2 = boxBolhas2140 || null;
    let derivado = false;

    if (!boxCol2 && boxBolhas) {
      // Deriva o box da coluna direita espelhando o box da esquerda no eixo X.
      const safe = sanitizeBox(boxBolhas, imgW, imgH);
      const novoX = clamp(imgW - safe.x - safe.w, 0, imgW - safe.w - 1);
      boxCol2 = { x: novoX, y: safe.y, w: safe.w, h: safe.h };
      derivado = true;
      if (Array.isArray(observacoes)) {
        observacoes.push(
          `Box 21-40 derivado (espelhado do 1-20): x=${boxCol2.x} y=${boxCol2.y} w=${boxCol2.w} h=${boxCol2.h}`,
        );
      }
    }

    if (boxCol2) {
      try {
        const r2 = await readGrid(buffer, boxCol2, {
          questoesDe: 21,
          questoesAte: 20 + col2Quantidade,
          alts,
          imgW,
          imgH,
          observacoes,
          label: derivado ? 'Coluna 21-40 (derivada)' : 'Coluna 21-40',
        });
        Object.assign(respostas, r2);
      } catch (e) {
        if (Array.isArray(observacoes)) {
          observacoes.push(`Falha ao ler coluna 21-40: ${e?.message || e}`);
        }
      }
    } else if (Array.isArray(observacoes)) {
      observacoes.push('Sem box para coluna 21-40; questões 21+ ficaram null');
    }
  }

  return respostas;
}
