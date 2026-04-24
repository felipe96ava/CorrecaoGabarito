export default function GridQuestoes({ correcaoQuestoes }) {
  if (!correcaoQuestoes) return null;

  const questoes = Object.entries(correcaoQuestoes).sort(([a], [b]) => Number(a) - Number(b));

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="font-semibold text-gray-700 mb-4">Questão a questão</h2>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">
        {questoes.map(([num, q]) => {
          const acerto = q.resultado === 'ACERTO';
          const anulada = q.aluno === 'ANULADA';
          return (
            <div
              key={num}
              title={`Q${num}: aluno=${q.aluno ?? '-'} gabarito=${q.gabarito}`}
              className={`rounded-lg p-2 text-center text-xs font-medium ${
                anulada
                  ? 'bg-yellow-100 text-yellow-700'
                  : acerto
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-600'
              }`}
            >
              <div className="text-gray-500 text-[10px]">{num}</div>
              <div>{q.aluno ?? '—'}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
