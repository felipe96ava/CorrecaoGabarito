import Spinner from './Spinner.jsx';

// Etapas do pipeline (mesma ordem do backend em lib/jobs.js).
//   currentStep: 0..5 — qual etapa o job está/atingiu.
//   status: 'processing' | 'done' | 'error'
const ETAPAS = [
  { id: 0, label: 'Upload', desc: 'Enviando o arquivo para o servidor' },
  { id: 1, label: 'Pré-processamento', desc: 'Ajustando rotação e qualidade' },
  { id: 2, label: 'Leitura do cartão', desc: 'Detectando as bolhas marcadas' },
  { id: 3, label: 'Identificação do aluno', desc: 'Lendo QR Code e cabeçalho' },
  { id: 4, label: 'Correção', desc: 'Comparando com o gabarito e calculando nota' },
  { id: 5, label: 'Concluído', desc: 'Resultado salvo' },
];

const TOTAL = ETAPAS.length;

function CheckIcon({ className = 'w-4 h-4 text-white' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.704 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 111.414-1.414L8.5 12.086l6.79-6.793a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function XIcon({ className = 'w-4 h-4 text-white' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function estadoEtapa(etapaId, currentStep, status) {
  if (status === 'error' && etapaId === currentStep) return 'error';
  if (etapaId < currentStep) return 'done';
  if (etapaId === currentStep) {
    if (status === 'done') return 'done';
    return 'active';
  }
  return 'pending';
}

function corDoEstado(estado) {
  switch (estado) {
    case 'done':
      return {
        bullet: 'bg-green-500 border-green-500',
        text: 'text-gray-700',
      };
    case 'active':
      return {
        bullet: 'bg-blue-600 border-blue-600',
        text: 'text-blue-700 font-medium',
      };
    case 'error':
      return {
        bullet: 'bg-red-500 border-red-500',
        text: 'text-red-700 font-medium',
      };
    default:
      return {
        bullet: 'bg-white border-gray-300',
        text: 'text-gray-400',
      };
  }
}

export default function ProcessingProgress({
  fileName,
  currentStep = 0,
  status = 'processing',
  errorMessage,
  onRetry,
  onRemove,
}) {
  const concluidas = (() => {
    if (status === 'done') return TOTAL;
    if (status === 'error') return Math.max(0, currentStep);
    return Math.max(0, currentStep);
  })();
  const percent = Math.round((concluidas / TOTAL) * 100);

  const etapaErroIdx = status === 'error' ? currentStep : -1;

  return (
    <div
      className={`bg-white rounded-xl shadow border p-4 transition-all ${
        status === 'error' ? 'border-red-200' : 'border-gray-200'
      }`}
      role="group"
      aria-label={`Progresso do arquivo ${fileName}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-gray-800 truncate" title={fileName}>
            {fileName}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {status === 'done' && 'Processamento concluído'}
            {status === 'error' && 'Falhou — verifique a mensagem abaixo'}
            {status === 'processing' && (
              <>
                Etapa {Math.min(TOTAL, currentStep + 1)} de {TOTAL} — {ETAPAS[currentStep]?.label || '...'}
              </>
            )}
          </div>
        </div>

        {status === 'error' && (
          <div className="flex gap-2 flex-shrink-0">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Tentar novamente
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="text-xs px-3 py-1.5 rounded-lg border text-gray-600 hover:bg-gray-50"
              >
                Remover
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mb-4">
        <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ease-out ${
              status === 'error' ? 'bg-red-500' : 'bg-blue-600'
            }`}
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${percent}% concluído`}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{percent}%</span>
          <span>
            {concluidas}/{TOTAL} etapas
          </span>
        </div>
      </div>

      <ol className="space-y-2 md:space-y-0 md:grid md:grid-cols-6 md:gap-2">
        {ETAPAS.map((etapa) => {
          const estado = estadoEtapa(etapa.id, currentStep, status);
          const cores = corDoEstado(estado);
          return (
            <li
              key={etapa.id}
              className="flex md:flex-col md:items-center md:text-center items-start gap-2"
              aria-label={`${etapa.label}: ${
                estado === 'done'
                  ? 'concluída'
                  : estado === 'active'
                    ? 'em andamento'
                    : estado === 'error'
                      ? 'erro'
                      : 'pendente'
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full border-2 flex-shrink-0 transition-colors duration-300 ${cores.bullet}`}
              >
                {estado === 'done' && <CheckIcon />}
                {estado === 'active' && <Spinner className="w-3.5 h-3.5 text-white" />}
                {estado === 'error' && <XIcon />}
                {estado === 'pending' && (
                  <span className="text-[10px] font-bold text-gray-400">{etapa.id + 1}</span>
                )}
              </span>
              <div className="min-w-0">
                <div className={`text-xs leading-tight ${cores.text}`}>{etapa.label}</div>
                <div className="hidden md:block text-[10px] text-gray-400 leading-tight mt-0.5">
                  {etapa.desc}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {status === 'error' && errorMessage && (
        <div
          role="alert"
          className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700"
        >
          <div className="font-medium mb-0.5">
            Erro em &quot;{ETAPAS[etapaErroIdx]?.label || 'etapa desconhecida'}&quot;
          </div>
          <div>{errorMessage}</div>
        </div>
      )}
    </div>
  );
}
