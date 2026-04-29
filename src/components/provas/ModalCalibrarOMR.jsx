import { useEffect, useMemo, useRef, useState } from 'react';
import { pdfParaImagem } from '../../utils/pdfParaImagem.js';

// Definição das colunas suportadas. Mantém ordem fixa: esquerda → direita.
const COLUNAS = [
  { key: 'box_bolhas_1_20',  label: 'Coluna 1 (1–20)',  cor: '#2563eb' }, // azul
  { key: 'box_bolhas_21_40', label: 'Coluna 2 (21–40)', cor: '#16a34a' }, // verde
  { key: 'box_bolhas_41_60', label: 'Coluna 3 (41–60)', cor: '#f59e0b' }, // âmbar
  { key: 'box_bolhas_61_80', label: 'Coluna 4 (61–80)', cor: '#dc2626' }, // vermelho
];

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.2;

function toRatioBox(rect, width, height) {
  if (!rect) return null;
  const x = Math.max(0, Math.min(1, rect.x / width));
  const y = Math.max(0, Math.min(1, rect.y / height));
  const w = Math.max(0, Math.min(1, rect.w / width));
  const h = Math.max(0, Math.min(1, rect.h / height));
  return { x, y, w, h };
}

function toPixelRect(ratioBox, width, height) {
  if (!ratioBox || !Number.isFinite(ratioBox.x)) return null;
  return {
    x: ratioBox.x * width,
    y: ratioBox.y * height,
    w: ratioBox.w * width,
    h: ratioBox.h * height,
  };
}

export default function ModalCalibrarOMR({
  open,
  onClose,
  onSave,
  saving,
  // existingBoxes = { box_bolhas_1_20, box_bolhas_21_40, box_bolhas_41_60, box_bolhas_61_80 }
  existingBoxes,
  // Quantas colunas a prova realmente usa (1..4). Default: 4.
  colunasNecessarias = 4,
}) {
  const [imgUrl, setImgUrl] = useState(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  // Map<colunaKey, rect em pixels da imagem natural>
  const [rects, setRects] = useState({});
  const [colunaAtiva, setColunaAtiva] = useState(COLUNAS[0].key);
  const [drag, setDrag] = useState(null);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  const colunasAtivas = COLUNAS.slice(0, Math.max(1, Math.min(COLUNAS.length, colunasNecessarias)));

  useEffect(() => {
    if (!open) return;
    setImgUrl(null);
    setRects({});
    setDrag(null);
    setZoom(1);
    setColunaAtiva(COLUNAS[0].key);
  }, [open]);

  useEffect(() => {
    if (!imgUrl || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = imgSize.w;
    canvas.height = imgSize.h;
    desenharOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgUrl, imgSize.w, imgSize.h, rects, colunaAtiva]);

  const ratioBoxes = useMemo(() => {
    const out = {};
    if (!imgSize.w || !imgSize.h) return out;
    for (const col of COLUNAS) {
      const r = rects[col.key];
      if (r) out[col.key] = toRatioBox(r, imgSize.w, imgSize.h);
    }
    return out;
  }, [rects, imgSize.w, imgSize.h]);

  const displayedSize = useMemo(() => {
    if (!imgSize.w || !imgSize.h) return { w: 0, h: 0 };
    return { w: imgSize.w * zoom, h: imgSize.h * zoom };
  }, [imgSize.w, imgSize.h, zoom]);

  function desenharOverlay() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const col of colunasAtivas) {
      const rect = rects[col.key];
      if (!rect) continue;
      const ativa = col.key === colunaAtiva;
      ctx.strokeStyle = col.cor;
      ctx.lineWidth = ativa ? 4 : 2;
      ctx.fillStyle = hexToRgba(col.cor, ativa ? 0.18 : 0.08);
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

      // Rótulo no canto superior esquerdo do retângulo
      const labelText = col.label;
      const fontSize = Math.max(14, Math.round(Math.min(canvas.width, canvas.height) * 0.018));
      ctx.font = `bold ${fontSize}px sans-serif`;
      const padding = 6;
      const textW = ctx.measureText(labelText).width + padding * 2;
      const textH = fontSize + padding * 2;
      ctx.fillStyle = col.cor;
      ctx.fillRect(rect.x, Math.max(0, rect.y - textH), textW, textH);
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'top';
      ctx.fillText(labelText, rect.x + padding, Math.max(0, rect.y - textH) + padding);
    }
  }

  function hexToRgba(hex, alpha) {
    const m = hex.replace('#', '');
    const r = parseInt(m.substring(0, 2), 16);
    const g = parseInt(m.substring(2, 4), 16);
    const b = parseInt(m.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  async function handleArquivo(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const fileEnvio = f.type === 'application/pdf' ? await pdfParaImagem(f) : f;
    const url = URL.createObjectURL(fileEnvio);
    setImgUrl(url);
  }

  function fitZoomParaContainer(naturalW) {
    const c = containerRef.current;
    if (!c || !naturalW) return 1;
    const padding = 16;
    const avail = Math.max(100, c.clientWidth - padding);
    const z = avail / naturalW;
    return Math.min(1, Math.max(ZOOM_MIN, z));
  }

  function onImgLoad() {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setImgSize({ w, h });
    setZoom(fitZoomParaContainer(w));
    // Hidrata retângulos vindos do banco (em ratio) para pixels.
    const novos = {};
    if (existingBoxes && typeof existingBoxes === 'object') {
      for (const col of COLUNAS) {
        const ratio = existingBoxes[col.key];
        const px = toPixelRect(ratio, w, h);
        if (px) novos[col.key] = px;
      }
    }
    setRects(novos);
  }

  function getPos(ev) {
    const canvas = canvasRef.current;
    const b = canvas.getBoundingClientRect();
    const x = ((ev.clientX - b.left) / b.width) * canvas.width;
    const y = ((ev.clientY - b.top) / b.height) * canvas.height;
    return { x, y };
  }

  function handleDown(ev) {
    if (!imgUrl) return;
    ev.preventDefault();
    const p = getPos(ev);
    setDrag({ x0: p.x, y0: p.y });
    setRects((prev) => ({ ...prev, [colunaAtiva]: { x: p.x, y: p.y, w: 1, h: 1 } }));
  }

  function handleMove(ev) {
    if (!drag) return;
    ev.preventDefault();
    const p = getPos(ev);
    const x = Math.min(drag.x0, p.x);
    const y = Math.min(drag.y0, p.y);
    const w = Math.abs(p.x - drag.x0);
    const h = Math.abs(p.y - drag.y0);
    setRects((prev) => ({ ...prev, [colunaAtiva]: { x, y, w, h } }));
  }

  function handleUp(ev) {
    if (!drag) return;
    ev.preventDefault();
    setDrag(null);
  }

  function clampZoom(z) {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  }

  function handleAjustar() {
    setZoom(fitZoomParaContainer(imgSize.w));
  }

  function limparColuna(key) {
    setRects((prev) => {
      const novo = { ...prev };
      delete novo[key];
      return novo;
    });
  }

  async function handleSalvar() {
    const box1 = ratioBoxes.box_bolhas_1_20;
    if (!box1 || box1.w < 0.02 || box1.h < 0.02) {
      alert('Marque pelo menos a Coluna 1 (1–20). Os outros recortes são opcionais.');
      return;
    }
    // Valida tamanho mínimo dos demais (caso o usuário tenha esboçado um clique e parado).
    for (const col of colunasAtivas) {
      const b = ratioBoxes[col.key];
      if (b && (b.w < 0.02 || b.h < 0.02)) {
        alert(`O retângulo da ${col.label} está muito pequeno. Refaça ou clique em "Limpar".`);
        return;
      }
    }
    const payload = {};
    for (const col of COLUNAS) {
      payload[col.key] = ratioBoxes[col.key] || null;
    }
    await onSave(payload);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Calibrar leitura (OMR)</h2>
            <p className="text-sm text-gray-500">
              Envie um cartão exemplo. Selecione a coluna ativa e desenhe SOMENTE o retângulo das bolhas (sem números/letras).
              Repita para cada coluna que a prova tiver (até 4 colunas / 80 questões).
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">Fechar</button>
        </div>

        <div className="p-5 space-y-4 overflow-auto flex-1 min-h-0">
          <div className="flex flex-wrap items-center gap-3">
            <input type="file" accept="image/*,application/pdf" onChange={handleArquivo} />

            {imgUrl && (
              <div className="ml-auto flex items-center gap-1 text-sm">
                <button
                  type="button"
                  onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
                  className="px-2 py-1 border rounded hover:bg-gray-50"
                  title="Diminuir zoom"
                >
                  −
                </button>
                <span className="px-2 tabular-nums w-14 text-center">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
                  className="px-2 py-1 border rounded hover:bg-gray-50"
                  title="Aumentar zoom"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={handleAjustar}
                  className="ml-2 px-2 py-1 border rounded hover:bg-gray-50"
                  title="Ajustar à largura"
                >
                  Ajustar
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="px-2 py-1 border rounded hover:bg-gray-50"
                  title="Zoom 100%"
                >
                  100%
                </button>
              </div>
            )}
          </div>

          {imgUrl && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-gray-700 font-medium mr-1">Coluna ativa:</span>
              {colunasAtivas.map((col) => {
                const ativa = col.key === colunaAtiva;
                const desenhada = !!rects[col.key];
                return (
                  <div key={col.key} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setColunaAtiva(col.key)}
                      className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 ${
                        ativa
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                      style={ativa ? { backgroundColor: col.cor, borderColor: col.cor } : undefined}
                    >
                      <span
                        className="inline-block w-3 h-3 rounded-sm"
                        style={{ backgroundColor: col.cor, opacity: ativa ? 1 : 0.7 }}
                      />
                      <span>{col.label}</span>
                      <span className={ativa ? 'text-white/80' : 'text-gray-400'}>
                        {desenhada ? '✓' : '○'}
                      </span>
                    </button>
                    {desenhada && (
                      <button
                        type="button"
                        onClick={() => limparColuna(col.key)}
                        className="text-xs px-2 py-1 border rounded hover:bg-gray-50 text-gray-600"
                        title="Limpar este retângulo"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!imgUrl && (
            <div className="text-sm text-gray-500">
              Dica: use PDF de scanner (300 dpi) ou foto bem reta, sem sombra. Com várias colunas, garanta que TODAS apareçam na imagem.
            </div>
          )}

          {imgUrl && (
            <div
              ref={containerRef}
              className="relative w-full max-h-[60vh] overflow-auto border rounded-lg bg-gray-50 p-2"
            >
              <div
                className="relative"
                style={{
                  width: displayedSize.w || 'auto',
                  height: displayedSize.h || 'auto',
                }}
              >
                <img
                  ref={imgRef}
                  src={imgUrl}
                  alt="prévia"
                  onLoad={onImgLoad}
                  draggable={false}
                  className="select-none block"
                  style={{
                    width: displayedSize.w || 'auto',
                    height: displayedSize.h || 'auto',
                    maxWidth: 'none',
                  }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute left-0 top-0 cursor-crosshair"
                  style={{
                    width: displayedSize.w || '100%',
                    height: displayedSize.h || '100%',
                  }}
                  onMouseDown={handleDown}
                  onMouseMove={handleMove}
                  onMouseUp={handleUp}
                  onMouseLeave={handleUp}
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t flex-shrink-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-gray-500 max-w-[60%]">
              {Object.keys(ratioBoxes).length === 0
                ? 'Marque um retângulo na imagem para a coluna selecionada.'
                : colunasAtivas
                    .filter((c) => ratioBoxes[c.key])
                    .map((c) => {
                      const b = ratioBoxes[c.key];
                      return `${c.label}: x=${b.x.toFixed(3)} y=${b.y.toFixed(3)} w=${b.w.toFixed(3)} h=${b.h.toFixed(3)}`;
                    })
                    .join(' • ')}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar calibração'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
