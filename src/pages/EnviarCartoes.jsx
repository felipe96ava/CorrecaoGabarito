import { useState } from 'react';
import { useProvas } from '../hooks/useProvas.js';
import { useUploadCartao, useCorrecoes } from '../hooks/useCorrecoes.js';
import DropzoneUpload from '../components/correcoes/DropzoneUpload.jsx';
import FilaProcessamento from '../components/correcoes/FilaProcessamento.jsx';

export default function EnviarCartoes() {
  const { data: provas = [] } = useProvas();
  const [provaId, setProvaId] = useState('');
  const [erros, setErros] = useState([]);
  const upload = useUploadCartao();
  const { data: correcoes = [] } = useCorrecoes(provaId || undefined);

  async function handleUpload(arquivos) {
    if (!provaId) return alert('Selecione uma prova antes de enviar os cartões.');
    setErros([]);
    for (const arquivo of arquivos) {
      try {
        await upload.mutateAsync({ arquivo, prova_id: provaId });
      } catch (err) {
        const msg = err.response?.data?.error || err.message;
        setErros((prev) => [...prev, `${arquivo.name}: ${msg}`]);
      }
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Enviar Cartões</h1>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Selecione a prova</label>
        <select
          value={provaId}
          onChange={(e) => setProvaId(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">-- escolha uma prova --</option>
          {provas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </div>

      <DropzoneUpload onUpload={handleUpload} loading={upload.isPending} />

      {erros.length > 0 && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
          {erros.map((e, i) => (
            <p key={i} className="text-sm text-red-600">{e}</p>
          ))}
        </div>
      )}

      {correcoes.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Cartões processados</h2>
          <FilaProcessamento correcoes={correcoes} />
        </div>
      )}
    </div>
  );
}
