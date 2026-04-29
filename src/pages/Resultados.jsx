import { useParams } from 'react-router-dom';
import { useProva } from '../hooks/useProvas.js';
import { useCorrecoes } from '../hooks/useCorrecoes.js';
import CartaoResultado from '../components/resultados/CartaoResultado.jsx';
import BarrasDisciplinas from '../components/resultados/BarrasDisciplinas.jsx';

export default function Resultados() {
  const { provaId } = useParams();
  const { data: prova } = useProva(provaId);
  const { data: correcoes = [], isLoading } = useCorrecoes(provaId);

  if (isLoading) return <p className="text-gray-500">Carregando resultados...</p>;

  const media =
    correcoes.length > 0
      ? (correcoes.reduce((acc, c) => acc + parseFloat(c.nota || 0), 0) / correcoes.length).toFixed(2)
      : '0.00';

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">{prova?.nome || 'Resultados'}</h1>
      <p className="text-gray-500 mb-6">{correcoes.length} cartões corrigidos · Média geral: {media}</p>

      {prova?.secoes?.length > 0 && (
        <div className="mb-8">
          <BarrasDisciplinas correcoes={correcoes} secoes={prova.secoes} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {correcoes.map((c) => (
          <CartaoResultado key={c.id} correcao={c} />
        ))}
      </div>

      {correcoes.length === 0 && (
        <p className="text-gray-400 text-center py-16">Nenhum cartão corrigido ainda.</p>
      )}
    </div>
  );
}
