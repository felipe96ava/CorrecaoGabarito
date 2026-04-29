import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api.js';

export function useProvas() {
  return useQuery({
    queryKey: ['provas'],
    queryFn: async () => {
      const { data } = await api.get('/provas');
      return data.data;
    },
  });
}

export function useProva(id) {
  return useQuery({
    queryKey: ['provas', id],
    queryFn: async () => {
      const { data } = await api.get(`/provas/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCriarProva() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/provas', payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['provas'] }),
  });
}

export function useAtualizarProva() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const { data } = await api.put(`/provas/${id}`, payload);
      return data.data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['provas'] });
      qc.invalidateQueries({ queryKey: ['provas', vars.id] });
    },
  });
}

export function useSalvarGabarito(provaId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gabarito) => {
      const { data } = await api.post(`/provas/${provaId}/gabarito`, { gabarito });
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['provas', provaId] }),
  });
}

export function useOmrConfig(provaId) {
  return useQuery({
    queryKey: ['provas', provaId, 'omr'],
    queryFn: async () => {
      const { data } = await api.get(`/provas/${provaId}/omr`);
      return data.data;
    },
    enabled: !!provaId,
  });
}

export function useSalvarOmrConfig(provaId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (boxes) => {
      // boxes = { box_bolhas_1_20, box_bolhas_21_40?, box_bolhas_41_60?, box_bolhas_61_80? }
      const payload = boxes && boxes.box_bolhas_1_20 ? boxes : { box_bolhas_1_20: boxes };
      const { data } = await api.put(`/provas/${provaId}/omr`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provas', provaId, 'omr'] });
    },
  });
}

export function useDeletarProva() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await api.delete(`/provas/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['provas'] }),
  });
}
