function parseJsonField(value, fallback) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'object' && value !== null) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function parseResultadoSecoes(correcao) {
  return parseJsonField(correcao?.resultado_secoes, []);
}

function calcularSecoesDeQuestoes(correcao, secoesProva) {
  const correcaoQuestoes = parseJsonField(correcao?.correcao_questoes, null);
  if (!correcaoQuestoes || !Array.isArray(secoesProva) || secoesProva.length === 0) return [];

  return secoesProva.map((s) => {
    const de = Number(s.questao_de);
    const ate = Number(s.questao_ate);
    if (!Number.isFinite(de) || !Number.isFinite(ate) || de > ate) {
      return { secao: s.nome || 'Seção', acertos: 0, total: 0, percentual: 0 };
    }

    let acertos = 0;
    let total = 0;
    for (let q = de; q <= ate; q++) {
      const item = correcaoQuestoes[String(q)];
      if (!item) continue;
      total += 1;
      if (item.resultado === 'ACERTO') acertos += 1;
    }
    const percentual = total > 0 ? Math.round((acertos / total) * 100) : 0;
    return { secao: s.nome || 'Seção', acertos, total, percentual };
  });
}

function corPercentual(p) {
  if (p >= 60) return 'bg-green-500';
  if (p >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

function corTexto(p) {
  if (p >= 60) return 'text-green-600';
  if (p >= 40) return 'text-yellow-600';
  return 'text-red-500';
}

export default function ListaSecoesAluno({ correcao, secoesProva }) {
  const salvo = parseResultadoSecoes(correcao).filter((s) => s && (s.total > 0 || s.percentual != null));
  const provaTemSecoes = Array.isArray(secoesProva) && secoesProva.length > 0;
  const soGeralSalvo = salvo.length === 1 && salvo[0].secao === 'Geral';

  // Se a prova tem matérias hoje, usa elas (mesmo que o cartão tenha sido corrigido
  // antes das seções existirem e ficou gravado só como "Geral").
  let secoes;
  if (provaTemSecoes && (salvo.length === 0 || soGeralSalvo)) {
    secoes = calcularSecoesDeQuestoes(correcao, secoesProva).filter((s) => s.total > 0);
  } else if (salvo.length > 0) {
    secoes = salvo;
  } else {
    secoes = calcularSecoesDeQuestoes(correcao, secoesProva).filter((s) => s.total > 0);
  }

  if (secoes.length === 0) {
    return null;
  }

  const soGeral = secoes.length === 1 && secoes[0].secao === 'Geral';

  return (
    <div className="bg-white rounded-xl shadow p-6 mb-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        {soGeral ? 'Desempenho geral' : 'Desempenho por matéria'}
      </h2>
      <ul className="space-y-4">
        {secoes.map((s) => {
          const pct = Number(s.percentual) || 0;
          const label = s.secao || 'Seção';
          return (
            <li key={label}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-800">{label}</span>
                <span className={`text-lg font-bold tabular-nums ${corTexto(pct)}`}>
                  {pct}%
                </span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${corPercentual(pct)}`}
                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {s.acertos ?? 0} de {s.total ?? 0} questões corretas
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
