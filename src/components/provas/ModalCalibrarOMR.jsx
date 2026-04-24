import { useEffect, useMemo, useRef, useState } from 'react';
import { pdfParaImagem } from '../../utils/pdfParaImagem.js';

function toRatioBox(rect, width, height) {
  if (!rect) return null;
  const x = Math.max(0, Math.min(1, rect.x / width));
  const y = Math.max(0, Math.min(1, rect.y / height));
  const w = Math.max(0, Math.min(1, rect.w / width));
  const h = Math.max(0, Math.min(1, rect.h / height));
  return { x, y, w, h };
}

export default function ModalCalibrarOMR({ open, onClose, onSave, saving, existingBox }) {
  const [arquivo, setArquivo] = useState(null);
  const [imgUrl, setImgUrl] = useState(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [rect, setRect] = useState(null);
  const [drag, setDrag] = useState(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setArquivo(null);
    setImgUrl(null);
    setRect(null);
    setDrag(null);
  }, [open]);

  useEffect(() => {
    if (!imgUrl || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = imgSize.w;
    canvas.height = imgSize.h;
    desenharOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgUrl, imgSize.w, imgSize.h, rect]);

  const ratioBox = useMemo(() => {
    if (!rect || !imgSize.w || !imgSize.h) return null;
    return toRatioBox(rect, imgSize.w, imgSize.h);
  }, [rect, imgSize.w, imgSize.h]);

  function desenharOverlay() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!rect) return;
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(37, 99, 235, 0.15)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }

  async function handleArquivo(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const fileEnvio = f.type === 'application/pdf' ? await pdfParaImagem(f) : f;
    setArquivo(fileEnvio);

    const url = URL.createObjectURL(fileEnvio);
    setImgUrl(url);
  }

  function onImgLoad() {
    const img = imgRef.current;
    if (!img) return;
    setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    if (existingBox?.unit === 'ratio') {
      setRect({
        x: existingBox.x * img.naturalWidth,
        y: existingBox.y * img.naturalHeight,
        w: existingBox.w * img.naturalWidth,
        h: existingBox.h * img.naturalHeight,
      });
    }
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
    setRect({ x: p.x, y: p.y, w: 1, h: 1 });
  }

  function handleMove(ev) {
    if (!drag) return;
    ev.preventDefault();
    const p = getPos(ev);
    const x = Math.min(drag.x0, p.x);
    const y = Math.min(drag.y0, p.y);
    const w = Math.abs(p.x - drag.x0);
    const h = Math.abs(p.y - drag.y0);
    setRect({ x, y, w, h });
  }

  function handleUp(ev) {
    if (!drag) return;
    ev.preventDefault();
    setDrag(null);
  }

  async function handleSalvar() {
    if (!ratioBox || ratioBox.w < 0.02 || ratioBox.h < 0.02) {
      alert('Marque um retângulo válido (somente a área das bolhas).');
      return;
    }
    await onSave(ratioBox);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Calibrar leitura (OMR)</h2>
            <p className="text-sm text-gray-500">
              Envie um cartão exemplo e marque SOMENTE o retângulo das bolhas das questões (sem números/letras).
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">Fechar</button>
        </div>

        <div className="p-5 space-y-4">
          <input type="file" accept="image/*,application/pdf" onChange={handleArquivo} />

          {!imgUrl && (
            <div className="text-sm text-gray-500">
              Dica: use PDF de scanner (300 dpi) ou foto bem reta, sem sombra.
            </div>
          )}

          {imgUrl && (
            <div className="relative w-full overflow-auto border rounded-lg bg-gray-50 p-2">
              <div className="relative inline-block">
                <img ref={imgRef} src={imgUrl} alt="prévia" onLoad={onImgLoad} className="max-w-none select-none" />
                <canvas
                  ref={canvasRef}
                  className="absolute left-0 top-0 cursor-crosshair"
                  onMouseDown={handleDown}
                  onMouseMove={handleMove}
                  onMouseUp={handleUp}
                  onMouseLeave={handleUp}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {ratioBox ? `Box salvo (ratio): x=${ratioBox.x.toFixed(3)} y=${ratioBox.y.toFixed(3)} w=${ratioBox.w.toFixed(3)} h=${ratioBox.h.toFixed(3)}` : 'Marque um retângulo na imagem.'}
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

