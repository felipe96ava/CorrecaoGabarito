import { useEffect, useRef, useState } from 'react';
import api from '../services/api.js';

const POLL_INTERVAL_MS = 1000;
const TIMEOUT_MS = 120_000;

// Faz polling em GET /correcoes/jobs/:id e retorna o último estado conhecido.
// Para automaticamente quando o status vira `done` ou `error`, ou após
// TIMEOUT_MS sem mudança (defesa contra função morta sem ter gravado erro).
//
// Uso:
//   const { step, status, errorMessage, correcaoId } = useProcessingJob(jobId, {
//     enabled: true,
//     onDone: (correcaoId) => ...,
//     onError: (msg) => ...,
//   });
export default function useProcessingJob(jobId, { enabled = true, onDone, onError } = {}) {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState('processing');
  const [errorMessage, setErrorMessage] = useState(null);
  const [correcaoId, setCorrecaoId] = useState(null);

  const onDoneRef = useRef(onDone);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onDoneRef.current = onDone;
    onErrorRef.current = onError;
  }, [onDone, onError]);

  // O timeout só fecha o card quando NADA muda durante a janela. Toda mudança
  // de step reseta o cronômetro local.
  const ultimaMudancaRef = useRef(Date.now());
  const ultimoStepRef = useRef(0);

  useEffect(() => {
    if (!enabled || !jobId) return undefined;

    let cancelado = false;
    let timer = null;

    setStep(0);
    setStatus('processing');
    setErrorMessage(null);
    setCorrecaoId(null);
    ultimaMudancaRef.current = Date.now();
    ultimoStepRef.current = 0;

    async function tick() {
      if (cancelado) return;

      try {
        const { data } = await api.get(`/correcoes/jobs/${jobId}`);
        const job = data?.data;
        if (!job) {
          throw new Error('Job não encontrado');
        }

        const novoStep = Number(job.step) || 0;
        const novoStatus = job.status || 'processing';

        if (novoStep !== ultimoStepRef.current) {
          ultimoStepRef.current = novoStep;
          ultimaMudancaRef.current = Date.now();
        }

        setStep(novoStep);
        setStatus(novoStatus);
        setErrorMessage(job.error_message || null);
        setCorrecaoId(job.correcao_id || null);

        if (novoStatus === 'done') {
          onDoneRef.current?.(job.correcao_id || null);
          return; // não reagenda
        }
        if (novoStatus === 'error') {
          onErrorRef.current?.(job.error_message || 'Falha desconhecida');
          return;
        }

        // Timeout client-side: passou MUITO tempo sem nenhum progresso.
        const idleMs = Date.now() - ultimaMudancaRef.current;
        if (idleMs > TIMEOUT_MS) {
          const msg =
            'O processamento parou de responder. Verifique sua conexão e tente novamente.';
          setStatus('error');
          setErrorMessage(msg);
          onErrorRef.current?.(msg);
          return;
        }
      } catch (err) {
        // 404: job não existe ainda (corrida cliente/servidor) — tenta de novo.
        // Outros erros: retorna erro definitivo.
        const code = err?.response?.status;
        if (code !== 404) {
          const msg = err?.response?.data?.error || err?.message || 'Erro ao consultar progresso';
          setStatus('error');
          setErrorMessage(msg);
          onErrorRef.current?.(msg);
          return;
        }
      }

      timer = setTimeout(tick, POLL_INTERVAL_MS);
    }

    tick();

    return () => {
      cancelado = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, enabled]);

  return { step, status, errorMessage, correcaoId };
}
