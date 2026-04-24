import { useNavigate, useParams } from 'react-router-dom';
import { useProva, useCriarProva, useAtualizarProva, useSalvarGabarito, useOmrConfig, useSalvarOmrConfig } from '../hooks/useProvas.js';
import FormProva from '../components/provas/FormProva.jsx';
import ModalCalibrarOMR from '../components/provas/ModalCalibrarOMR.jsx';
import { useState } from 'react';

export default function CadastroProva() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: prova, isLoading: isLoadingProva, isError } = useProva(id);
  const criar = useCriarProva();
  const atualizar = useAtualizarProva();
  const salvarGabarito = useSalvarGabarito(id);
  const { data: omrConfig } = useOmrConfig(id);
  const salvarOmr = useSalvarOmrConfig(id);
  const [openOmr, setOpenOmr] = useState(false);

  const loading = criar.isPending || atualizar.isPending || salvarGabarito.isPending;

  async function handleSalvar({ gabarito, secoes, ...campos }) {
    if (id) {
      await atualizar.mutateAsync({ id, ...campos });
      if (gabarito?.length > 0) await salvarGabarito.mutateAsync(gabarito);
    } else {
      await criar.mutateAsync({ ...campos, gabarito, secoes });
    }
    navigate('/provas');
  }

  if (id && isLoadingProva) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Editar Prova</h1>
        <p className="text-gray-500">Carregando dados da prova...</p>
      </div>
    );
  }

  if (id && (isError || !prova)) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Editar Prova</h1>
        <p className="text-red-600">Não foi possível carregar os dados da prova.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{id ? 'Editar Prova' : 'Nova Prova'}</h1>
      {id && (
        <div className="mb-4 flex items-center justify-between bg-white rounded-xl shadow p-4">
          <div>
            <div className="font-medium text-gray-800">Leitura do cartão (OMR)</div>
            <div className="text-sm text-gray-500">
              {omrConfig?.box_bolhas_1_20 ? 'Calibração salva. A leitura usa o recorte fixo desta prova.' : 'Sem calibração. A leitura pode falhar dependendo da foto.'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpenOmr(true)}
            className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50"
          >
            Calibrar leitura
          </button>
        </div>
      )}
      <FormProva provaInicial={prova} onSalvar={handleSalvar} loading={loading} />

      {id && (
        <ModalCalibrarOMR
          open={openOmr}
          onClose={() => setOpenOmr(false)}
          existingBox={omrConfig?.box_bolhas_1_20 || null}
          saving={salvarOmr.isPending}
          onSave={async (box) => {
            await salvarOmr.mutateAsync(box);
            setOpenOmr(false);
            alert('Calibração salva! Agora reenvie um cartão para testar a leitura.');
          }}
        />
      )}
    </div>
  );
}
