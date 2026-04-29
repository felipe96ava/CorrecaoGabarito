import { Link } from 'react-router-dom';

export default function FilaProcessamento({ correcoes }) {
  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">Aluno</th>
            <th className="px-4 py-3 text-left">Nota</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">QR Code</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {correcoes.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-800">{c.aluno_nome || 'Não identificado'}</td>
              <td className="px-4 py-3 font-medium">{c.nota ?? '-'}</td>
              <td className="px-4 py-3">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    c.status === 'APROVADO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}
                >
                  {c.status}
                </span>
              </td>
              <td className="px-4 py-3">
                {c.qrcode_valido ? (
                  <span className="text-green-600 text-xs">OK</span>
                ) : (
                  <span className="text-yellow-600 text-xs">Manual</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <Link to={`/resultados/aluno/${c.id}`} className="text-blue-600 hover:underline text-xs">
                  Ver detalhes
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
