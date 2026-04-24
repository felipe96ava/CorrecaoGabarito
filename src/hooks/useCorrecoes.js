import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api.js';
import { pdfParaImagem } from '../utils/pdfParaImagem.js';

export function useCorrecoes(provaId) {
  return useQuery({
    queryKey: ['correcoes', provaId],
    queryFn: async () => {
      const params = provaId ? { prova_id: provaId } : {};
      const { data } = await api.get('/correcoes', { params });
      return data.data;
    },
  });
}

export function useCorrecao(id) {
  return useQuery({
    queryKey: ['correcoes', 'detail', id],
    queryFn: async () => {
      const { data } = await api.get(`/correcoes/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useUploadCartao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ arquivo, prova_id }) => {
      const fileEnvio = arquivo.type === 'application/pdf' ? await pdfParaImagem(arquivo) : arquivo;
      const form = new FormData();
      form.append('arquivo', fileEnvio);
      form.append('prova_id', prova_id);
      const { data } = await api.post('/correcoes/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['correcoes', vars.prova_id] });
    },
  });
}
