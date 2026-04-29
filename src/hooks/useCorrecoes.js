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

// Cria um job em correcao_jobs antes do upload, para que o cliente já tenha
// um id pra pollar o progresso enquanto o /upload está rolando.
// `onJobCreated(jobId)` é chamado assim que o job é criado, antes do upload
// pesado começar — o caller usa isso pra renderizar o card de progresso.
export function useUploadCartao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ arquivo, prova_id, onJobCreated }) => {
      const fileEnvio = arquivo.type === 'application/pdf' ? await pdfParaImagem(arquivo) : arquivo;

      let jobId = null;
      try {
        const { data: jobResp } = await api.post('/correcoes/jobs', {
          prova_id,
          arquivo_nome: arquivo.name,
        });
        jobId = jobResp?.data?.id || null;
        if (jobId && typeof onJobCreated === 'function') {
          onJobCreated(jobId);
        }
      } catch (err) {
        // Sem job → segue sem progresso (degradação graciosa).
        console.warn('[upload] Falha ao criar job de progresso:', err?.message || err);
      }

      const form = new FormData();
      form.append('arquivo', fileEnvio);
      form.append('prova_id', prova_id);
      if (jobId) form.append('job_id', jobId);

      const { data } = await api.post('/correcoes/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { correcao: data.data, jobId };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['correcoes', vars.prova_id] });
    },
  });
}
