import { Link } from 'react-router-dom';
import { useProvas, useDeletarProva } from '../hooks/useProvas.js';

export default function MinhasProvas() {
  const { data: provas = [], isLoading } = useProvas();
  const deletar = useDeletarProva();

  function handleDelete(id) {
    if (confirm('Deseja excluir esta prova?')) deletar.mutate(id);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Minhas Provas</h1>
        <Link
          to="/provas/nova"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          Nova prova
        </Link>
      </div>

      {isLoading && <p className="text-gray-500">Carregando...</p>}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Etapa</th>
              <th className="px-4 py-3 text-left">Data</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {provas.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{p.nome}</td>
                <td className="px-4 py-3 text-gray-600">{p.etapa || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{p.data_prova || '-'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.status === 'publicado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 flex gap-2 justify-end">
                  <Link to={`/provas/${p.id}/editar`} className="text-blue-600 hover:underline">
                    Editar
                  </Link>
                  <Link to={`/resultados/${p.id}`} className="text-gray-600 hover:underline">
                    Resultados
                  </Link>
                  <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:underline">
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {provas.length === 0 && !isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Nenhuma prova cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
