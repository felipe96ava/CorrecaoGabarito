import { useProvas } from '../hooks/useProvas.js';
import { useCorrecoes } from '../hooks/useCorrecoes.js';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { data: provas = [] } = useProvas();
  const { data: correcoes = [] } = useCorrecoes();

  const stats = [
    { label: 'Provas cadastradas', value: provas.length },
    { label: 'Cartões corrigidos', value: correcoes.length },
    { label: 'Aprovados', value: correcoes.filter((c) => c.status === 'APROVADO').length },
    { label: 'Reprovados', value: correcoes.filter((c) => c.status === 'REPROVADO').length },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow p-5">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <Link
          to="/provas/nova"
          className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          Nova prova
        </Link>
        <Link
          to="/correcoes"
          className="bg-white border text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
        >
          Enviar cartões
        </Link>
      </div>
    </div>
  );
}
