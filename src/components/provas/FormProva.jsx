import { useEffect, useMemo, useState } from 'react';
import TabelaSecoes from './TabelaSecoes.jsx';
import GridGabarito from './GridGabarito.jsx';

const ETAPAS = ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre', 'Final'];
const MODALIDADES = ['Regular', 'EJA', 'Técnico'];

export default function FormProva({ provaInicial, onSalvar, loading }) {
  const provaKey = provaInicial?.id ?? null;

  const initialForm = useMemo(() => {
    const rawDate = provaInicial?.data_prova || '';
    const normalizedDate = typeof rawDate === 'string' ? rawDate.split('T')[0] : '';
    return {
      nome: provaInicial?.nome || '',
      unidade: provaInicial?.unidade || '',
      ano_escolar: provaInicial?.ano_escolar || '',
      modalidade: provaInicial?.modalidade || '',
      etapa: provaInicial?.etapa || '',
      caderno: provaInicial?.caderno || '',
      data_prova: normalizedDate,
      total_questoes: provaInicial?.total_questoes || 20,
      alternativas: provaInicial?.alternativas || 'A-E',
    };
  }, [provaKey, provaInicial]);

  const [form, setForm] = useState(initialForm);
  const [secoes, setSecoes] = useState(provaInicial?.secoes || []);
  const [gabarito, setGabarito] = useState(provaInicial?.gabarito || []);

  useEffect(() => {
    if (!provaInicial) return;
    setForm(initialForm);
    setSecoes(provaInicial?.secoes || []);
    setGabarito(provaInicial?.gabarito || []);
  }, [provaKey, provaInicial, initialForm]);

  function set(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await onSalvar({ ...form, total_questoes: Number(form.total_questoes), secoes, gabarito });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-xl shadow p-6 grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Nome da prova</label>
          <input className="input" required value={form.nome} onChange={set('nome')} />
        </div>
        <div>
          <label className="label">Unidade</label>
          <input className="input" value={form.unidade} onChange={set('unidade')} />
        </div>
        <div>
          <label className="label">Ano escolar</label>
          <input className="input" value={form.ano_escolar} onChange={set('ano_escolar')} />
        </div>
        <div>
          <label className="label">Modalidade</label>
          <select className="input" value={form.modalidade} onChange={set('modalidade')}>
            <option value="">-</option>
            {MODALIDADES.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Etapa</label>
          <select className="input" value={form.etapa} onChange={set('etapa')}>
            <option value="">-</option>
            {ETAPAS.map((e) => <option key={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Caderno</label>
          <input className="input" value={form.caderno} onChange={set('caderno')} />
        </div>
        <div>
          <label className="label">Data da prova</label>
          <input type="date" className="input" value={form.data_prova} onChange={set('data_prova')} />
        </div>
        <div>
          <label className="label">Total de questões</label>
          <input type="number" min={1} max={200} className="input" value={form.total_questoes} onChange={set('total_questoes')} />
        </div>
        <div>
          <label className="label">Alternativas</label>
          <select className="input" value={form.alternativas} onChange={set('alternativas')}>
            <option value="A-D">A-D (4 opções)</option>
            <option value="A-E">A-E (5 opções)</option>
          </select>
        </div>
      </div>

      <TabelaSecoes secoes={secoes} onChange={setSecoes} totalQuestoes={Number(form.total_questoes)} />

      <GridGabarito
        totalQuestoes={Number(form.total_questoes)}
        alternativas={form.alternativas}
        gabarito={gabarito}
        onChange={setGabarito}
      />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {loading ? 'Salvando...' : 'Salvar prova'}
        </button>
      </div>
    </form>
  );
}
