export default function TabelaSecoes({ secoes, onChange, totalQuestoes }) {
  function addSecao() {
    onChange([...secoes, { nome: '', questao_de: 1, questao_ate: totalQuestoes }]);
  }

  function updateSecao(index, field, value) {
    const updated = secoes.map((s, i) => (i === index ? { ...s, [field]: value } : s));
    onChange(updated);
  }

  function removeSecao(index) {
    onChange(secoes.filter((_, i) => i !== index));
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-700">Seções / Disciplinas</h2>
        <button
          type="button"
          onClick={addSecao}
          className="text-sm text-blue-600 hover:underline"
        >
          + Adicionar seção
        </button>
      </div>

      {secoes.length === 0 && (
        <p className="text-sm text-gray-400">Nenhuma seção adicionada.</p>
      )}

      <div className="space-y-3">
        {secoes.map((s, i) => (
          <div key={i} className="flex gap-3 items-center">
            <input
              className="input flex-1"
              placeholder="Nome da disciplina"
              value={s.nome}
              onChange={(e) => updateSecao(i, 'nome', e.target.value)}
            />
            <input
              type="number"
              className="input w-24"
              placeholder="De"
              value={s.questao_de}
              onChange={(e) => updateSecao(i, 'questao_de', Number(e.target.value))}
            />
            <input
              type="number"
              className="input w-24"
              placeholder="Até"
              value={s.questao_ate}
              onChange={(e) => updateSecao(i, 'questao_ate', Number(e.target.value))}
            />
            <button
              type="button"
              onClick={() => removeSecao(i)}
              className="text-red-400 hover:text-red-600 text-lg leading-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
