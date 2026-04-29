import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCorrecao } from '../hooks/useCorrecoes.js';
import GridQuestoes from '../components/resultados/GridQuestoes.jsx';

export default function ResultadoAluno() {
  const { alunoId } = useParams();
  const { data: correcao, isLoading } = useCorrecao(alunoId);
  const [verDebug, setVerDebug] = useState(false);
  const [verObs, setVerObs] = useState(false);

  if (isLoading) return <p className="text-gray-500">Carregando...</p>;
  if (!correcao) return <p className="text-red-500">Correção não encontrada.</p>;

  const observacoes = Array.isArray(correcao.observacoes) ? correcao.observacoes : [];

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">{correcao.aluno_nome}</h1>
      <p className="text-gray-500 mb-6">{correcao.prova_nome}</p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <p className="text-sm text-gray-500">Nota</p>
          <p className="text-3xl font-bold text-blue-600">{correcao.nota}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <p className="text-sm text-gray-500">Acertos</p>
          <p className="text-3xl font-bold text-green-600">{correcao.total_acertos}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <p className="text-sm text-gray-500">Status</p>
          <p
            className={`text-xl font-bold mt-1 ${
              correcao.status === 'APROVADO' ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {correcao.status}
          </p>
        </div>
      </div>

      <GridQuestoes correcaoQuestoes={correcao.correcao_questoes} />

      {(correcao.arquivo_url || correcao.arquivo_debug_url) && (
        <div className="bg-white rounded-xl shadow p-5 mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">Cartão lido (debug visual)</h2>
            {correcao.arquivo_debug_url && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={verDebug}
                  onChange={(e) => setVerDebug(e.target.checked)}
                />
                Mostrar overlay do OMR
              </label>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Verde = bolha escolhida · Vermelho = ≥40% mas não escolhida · Amarelo = 20-40% · Cinza = vazia.
            Use isto pra ver onde a grade está caindo: se os círculos não estão alinhados com as bolhas reais, recalibre.
          </p>
          <div className="overflow-auto border rounded-lg bg-gray-50 p-2">
            {verDebug && correcao.arquivo_debug_url ? (
              <img src={correcao.arquivo_debug_url} alt="overlay debug OMR" className="max-w-full" />
            ) : correcao.arquivo_url ? (
              <img src={correcao.arquivo_url} alt="cartão original" className="max-w-full" />
            ) : (
              <p className="text-sm text-gray-500">Sem imagem salva.</p>
            )}
          </div>
        </div>
      )}

      {observacoes.length > 0 && (
        <div className="bg-white rounded-xl shadow p-5 mt-6">
          <button
            type="button"
            onClick={() => setVerObs(!verObs)}
            className="text-sm font-semibold text-gray-800 hover:text-blue-600"
          >
            {verObs ? '▾' : '▸'} Observações do processamento ({observacoes.length})
          </button>
          {verObs && (
            <pre className="mt-3 text-xs text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 p-3 rounded">
              {observacoes.join('\n')}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
