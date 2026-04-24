import { useParams } from 'react-router-dom';
import { useCorrecao } from '../hooks/useCorrecoes.js';
import GridQuestoes from '../components/resultados/GridQuestoes.jsx';

export default function ResultadoAluno() {
  const { alunoId } = useParams();
  const { data: correcao, isLoading } = useCorrecao(alunoId);

  if (isLoading) return <p className="text-gray-500">Carregando...</p>;
  if (!correcao) return <p className="text-red-500">Correção não encontrada.</p>;

  return (
    <div className="max-w-3xl">
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
    </div>
  );
}
