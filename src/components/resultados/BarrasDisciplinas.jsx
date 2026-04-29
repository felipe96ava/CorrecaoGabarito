import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function BarrasDisciplinas({ correcoes, secoes }) {
  const dados = secoes.map((s) => {
    const medias = correcoes
      .map((c) => {
        const sec = (c.resultado_secoes || []).find((r) => r.secao === s.nome);
        return sec ? sec.percentual : null;
      })
      .filter((v) => v !== null);

    const media = medias.length > 0 ? Math.round(medias.reduce((a, b) => a + b, 0) / medias.length) : 0;
    return { nome: s.nome, media };
  });

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="font-semibold text-gray-700 mb-4">Média por disciplina (%)</h2>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={dados} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
          <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => `${v}%`} />
          <Bar dataKey="media" radius={[4, 4, 0, 0]}>
            {dados.map((_, i) => (
              <Cell key={i} fill="#2563eb" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
