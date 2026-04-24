import { useNavigate, useParams } from 'react-router-dom';
import { useProva, useCriarProva, useAtualizarProva } from '../hooks/useProvas.js';
import api from '../services/api.js';
import FormProva from '../components/provas/FormProva.jsx';

export default function CadastroProva() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: prova } = useProva(id);
  const criar = useCriarProva();
  const atualizar = useAtualizarProva();

  const loading = criar.isPending || atualizar.isPending;

  async function handleSalvar({ gabarito, secoes, ...campos }) {
    if (id) {
      await atualizar.mutateAsync({ id, ...campos });
      if (gabarito?.length > 0) {
        await api.post(`/provas/${id}/gabarito`, { gabarito });
      }
    } else {
      await criar.mutateAsync({ ...campos, gabarito, secoes });
    }
    navigate('/provas');
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{id ? 'Editar Prova' : 'Nova Prova'}</h1>
      <FormProva provaInicial={prova} onSalvar={handleSalvar} loading={loading} />
    </div>
  );
}
