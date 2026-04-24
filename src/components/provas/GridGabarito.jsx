const OPCOES = {
  'A-E': ['A', 'B', 'C', 'D', 'E'],
  'A-D': ['A', 'B', 'C', 'D'],
};

export default function GridGabarito({ totalQuestoes, alternativas, gabarito, onChange }) {
  const opcoes = OPCOES[alternativas] || OPCOES['A-E'];

  function getResposta(numero) {
    return gabarito.find((g) => g.numero === numero)?.resposta || '';
  }

  function setResposta(numero, resposta) {
    const sem = gabarito.filter((g) => g.numero !== numero);
    onChange([...sem, { numero, resposta }]);
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="font-semibold text-gray-700 mb-4">Gabarito oficial</h2>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        {Array.from({ length: totalQuestoes }, (_, i) => i + 1).map((n) => (
          <div key={n} className="flex items-center gap-2">
            <span className="text-sm text-gray-500 w-6 text-right">{n}.</span>
            <div className="flex gap-1">
              {opcoes.map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setResposta(n, op)}
                  className={`w-7 h-7 rounded-full text-xs font-bold border transition ${
                    getResposta(n) === op
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-600 hover:border-blue-400'
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
