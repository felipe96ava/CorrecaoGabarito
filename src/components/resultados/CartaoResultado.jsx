import { Link } from 'react-router-dom';

export default function CartaoResultado({ correcao }) {
  const aprovado = correcao.status === 'APROVADO';

  return (
    <div className="bg-white rounded-xl shadow p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-gray-800">{correcao.aluno_nome || 'Não identificado'}</p>
          <p className="text-xs text-gray-400">{correcao.turma} · {correcao.serie}</p>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            aprovado ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
          }`}
        >
          {correcao.status}
        </span>
      </div>

      <div className="flex items-end gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-400">Nota</p>
          <p className="text-2xl font-bold text-blue-600">{correcao.nota}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Acertos</p>
          <p className="text-2xl font-bold text-gray-700">{correcao.total_acertos}</p>
        </div>
      </div>

      <Link
        to={`/resultados/aluno/${correcao.id}`}
        className="text-sm text-blue-600 hover:underline"
      >
        Ver detalhes
      </Link>
    </div>
  );
}
