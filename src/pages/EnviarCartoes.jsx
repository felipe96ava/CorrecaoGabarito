import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProvas, useOmrConfig } from '../hooks/useProvas.js';
import { useUploadCartao, useCorrecoes } from '../hooks/useCorrecoes.js';
import DropzoneUpload from '../components/correcoes/DropzoneUpload.jsx';
import FilaProcessamento from '../components/correcoes/FilaProcessamento.jsx';
import ProcessingProgress from '../components/correcoes/ProcessingProgress.jsx';
import Toast from '../components/correcoes/Toast.jsx';
import useProcessingJob from '../hooks/useProcessingJob.js';

// Quantos uploads rodam em paralelo. A OpenAI é o gargalo real, então
// concorrência alta NÃO acelera muito e ainda aumenta o risco de rate-limit.
const MAX_CONCURRENT = 3;

let nextTempId = 1;

export default function EnviarCartoes() {
  const { data: provas = [] } = useProvas();
  const [provaId, setProvaId] = useState('');
  const upload = useUploadCartao();
  const { data: correcoes = [] } = useCorrecoes(provaId || undefined);
  const { data: omrConfig, isLoading: loadingOmr } = useOmrConfig(provaId || undefined);

  const provaSelecionada = provas.find((p) => p.id === provaId);
  const calibrado = !!omrConfig?.box_bolhas_1_20;

  // Cada item:
  //   { tempId, fileName, file, provaId, status: 'queued'|'processing'|'error', jobId?, errorMessage? }
  //   (ao concluir com sucesso, o item é REMOVIDO da lista)
  const [itens, setItens] = useState([]);
  const [concluidos, setConcluidos] = useState(0);
  const [toast, setToast] = useState({ open: false, message: '', variant: 'success' });

  // Refs para evitar re-disparar o worker pelo mesmo item.
  const startedRef = useRef(new Set());

  function patchItem(tempId, fields) {
    setItens((prev) => prev.map((it) => (it.tempId === tempId ? { ...it, ...fields } : it)));
  }
  function removeItem(tempId) {
    setItens((prev) => prev.filter((it) => it.tempId !== tempId));
    startedRef.current.delete(tempId);
  }

  const startProcessing = useCallback(
    async (item) => {
      if (!item?.tempId) return;
      const tempId = item.tempId;
      if (startedRef.current.has(tempId)) return;
      startedRef.current.add(tempId);

      patchItem(tempId, { status: 'processing', jobId: null, errorMessage: null });

      try {
        await upload.mutateAsync({
          arquivo: item.file,
          prova_id: item.provaId,
          onJobCreated: (jobId) => patchItem(tempId, { jobId }),
        });
        // O polling do useProcessingJob detecta `status=done` e dispara onDone,
        // que remove o card. A invalidação da listagem já roda no onSuccess
        // do useUploadCartao.
      } catch (err) {
        const msg =
          err?.response?.data?.error ||
          err?.message ||
          'Falha ao enviar o cartão. Tente novamente.';
        patchItem(tempId, { status: 'error', errorMessage: msg });
        startedRef.current.delete(tempId);
      }
    },
    [upload],
  );

  // Worker: enquanto houver slot livre e item na fila, dispara o próximo.
  useEffect(() => {
    const processing = itens.filter((it) => it.status === 'processing').length;
    const slots = MAX_CONCURRENT - processing;
    if (slots <= 0) return;
    const queued = itens.filter((it) => it.status === 'queued').slice(0, slots);
    queued.forEach((it) => startProcessing(it));
  }, [itens, startProcessing]);

  // Quando todos os itens terminam (lista vazia) e pelo menos 1 foi concluído
  // com sucesso na batelada atual, mostra um toast discreto.
  useEffect(() => {
    if (itens.length === 0 && concluidos > 0) {
      const n = concluidos;
      setToast({
        open: true,
        variant: 'success',
        message:
          n === 1
            ? '1 cartão processado com sucesso.'
            : `${n} cartões processados com sucesso.`,
      });
      setConcluidos(0);
    }
  }, [itens.length, concluidos]);

  function handleUpload(arquivos) {
    if (!provaId) return alert('Selecione uma prova antes de enviar os cartões.');
    if (!calibrado) {
      const ok = confirm(
        'Esta prova ainda NÃO foi calibrada. A leitura vai usar um chute baseado no layout padrão SESI e ' +
          'pode errar bastante. Recomendamos calibrar antes de enviar.\n\nDeseja enviar mesmo assim?',
      );
      if (!ok) return;
    }
    const novos = arquivos.map((f) => ({
      tempId: `t${nextTempId++}`,
      fileName: f.name,
      file: f,
      provaId,
      status: 'queued',
      jobId: null,
      errorMessage: null,
    }));
    setItens((prev) => [...prev, ...novos]);
  }

  function handleRetry(tempId) {
    startedRef.current.delete(tempId);
    patchItem(tempId, { status: 'queued', jobId: null, errorMessage: null });
  }

  // Total da batelada atual = ativos + já concluídos nesta sessão.
  const total = itens.length + concluidos;
  const processandoNum = itens.filter((it) => it.status === 'processing').length;
  const naFila = itens.filter((it) => it.status === 'queued').length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Enviar Cartões</h1>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Selecione a prova</label>
        <select
          value={provaId}
          onChange={(e) => setProvaId(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">-- escolha uma prova --</option>
          {provas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </div>

      {provaSelecionada && !loadingOmr && (
        <div
          className={`mb-6 rounded-xl border p-4 flex items-start gap-3 ${
            calibrado ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-300'
          }`}
        >
          <div className="flex-1">
            <div className={`font-semibold ${calibrado ? 'text-green-800' : 'text-yellow-900'}`}>
              {calibrado ? 'Leitura calibrada para esta prova.' : 'Esta prova NÃO está calibrada.'}
            </div>
            <div className={`text-sm mt-1 ${calibrado ? 'text-green-700' : 'text-yellow-800'}`}>
              {calibrado
                ? 'O OMR vai usar o recorte salvo das bolhas — leitura precisa.'
                : 'Sem o recorte das bolhas, a leitura cai num chute baseado no layout padrão SESI ' +
                  'e costuma marcar a maioria das questões como null/erradas. Calibre antes para ter precisão.'}
            </div>
          </div>
          {!calibrado && (
            <Link
              to={`/provas/${provaId}/editar`}
              className="px-4 py-2 rounded-lg bg-yellow-600 text-white hover:bg-yellow-700 text-sm font-medium whitespace-nowrap"
            >
              Calibrar agora
            </Link>
          )}
        </div>
      )}

      <DropzoneUpload onUpload={handleUpload} loading={false} />

      {itens.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-700">Processando agora</h2>
            <span className="text-sm text-gray-500">
              {total > 0 && (
                <>
                  Processando {processandoNum} de {total}
                  {naFila > 0 && <> &middot; {naFila} na fila</>}
                </>
              )}
            </span>
          </div>
          <div className="space-y-3">
            {itens.map((item) => (
              <ItemCard
                key={item.tempId}
                item={item}
                onDone={() => {
                  setConcluidos((n) => n + 1);
                  removeItem(item.tempId);
                }}
                onError={(msg) => {
                  patchItem(item.tempId, { status: 'error', errorMessage: msg });
                  startedRef.current.delete(item.tempId);
                }}
                onRetry={() => handleRetry(item.tempId)}
                onRemove={() => removeItem(item.tempId)}
              />
            ))}
          </div>
        </div>
      )}

      {correcoes.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Cartões processados</h2>
          <FilaProcessamento correcoes={correcoes} />
        </div>
      )}

      <Toast
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </div>
  );
}

// Componente filho: dono do polling de UM item. Fica isolado para que cada
// card tenha seu próprio useProcessingJob e o re-render não afete os outros.
function ItemCard({ item, onDone, onError, onRetry, onRemove }) {
  const ativo = !!item.jobId && item.status === 'processing';
  const { step, status, errorMessage } = useProcessingJob(item.jobId, {
    enabled: ativo,
    onDone: () => onDone(),
    onError: (msg) => onError(msg),
  });

  // Estado a renderizar: prioridade para o estado local (queued/error definitivo)
  // e cai pra polling quando ativo.
  let displayStep;
  let displayStatus;
  let displayError;

  if (item.status === 'error') {
    displayStep = 0;
    displayStatus = 'error';
    displayError = item.errorMessage || 'Falha desconhecida';
  } else if (item.status === 'queued') {
    displayStep = 0;
    displayStatus = 'processing';
    displayError = null;
  } else if (!item.jobId) {
    // Aguardando criar o job (POST /jobs em voo).
    displayStep = 0;
    displayStatus = 'processing';
    displayError = null;
  } else {
    displayStep = step;
    displayStatus = status;
    displayError = errorMessage;
  }

  return (
    <ProcessingProgress
      fileName={item.fileName}
      currentStep={displayStep}
      status={displayStatus}
      errorMessage={displayError}
      onRetry={displayStatus === 'error' ? onRetry : undefined}
      onRemove={displayStatus === 'error' ? onRemove : undefined}
    />
  );
}
