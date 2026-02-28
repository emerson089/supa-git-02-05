import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RESPONSAVEIS_POR_ETAPA } from '@/data/production-data';
import { toast } from 'sonner';

export interface Prestador {
  id: string;
  nome: string;
  etapas: string[];
  ativo: boolean;
}

export function usePrestadoresServico(etapaAtual?: string) {
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPrestadores = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('prestadores_servico')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;

      // Cast the data to the correct type
      const typedData: Prestador[] = (data || []).map(item => ({
        id: item.id,
        nome: item.nome,
        etapas: item.etapas as string[],
        ativo: item.ativo ?? true,
      }));

      setPrestadores(typedData);
    } catch (error) {
      console.error('Erro ao buscar prestadores:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrestadores();
  }, [fetchPrestadores]);

  // Filtra prestadores pela etapa atual
  const prestadoresFiltrados = etapaAtual
    ? prestadores.filter(p => p.etapas.includes(etapaAtual))
    : prestadores;

  // Combina com os responsáveis padrão da etapa
  const responsaveisPadrao = etapaAtual ? RESPONSAVEIS_POR_ETAPA[etapaAtual] || [] : [];

  // Lista final: responsáveis padrão + prestadores do banco (sem duplicados)
  const nomesDosPrestadores = prestadoresFiltrados.map(p => p.nome);
  const todosResponsaveis = [
    ...responsaveisPadrao.filter(r => !nomesDosPrestadores.includes(r)),
    ...nomesDosPrestadores
  ];

  // Função para adicionar novo prestador
  const addPrestador = async (nome: string, etapas: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('prestadores_servico')
        .insert({ nome, etapas, user_id: user.id })
        .select()
        .single();

      if (error) throw error;

      const newPrestador: Prestador = {
        id: data.id,
        nome: data.nome,
        etapas: data.etapas as string[],
        ativo: data.ativo ?? true,
      };

      setPrestadores(prev => [...prev, newPrestador]);
      toast.success(`Prestador "${nome}" adicionado com sucesso!`);
      return newPrestador;
    } catch (error) {
      console.error('Erro ao adicionar prestador:', error);
      toast.error('Erro ao adicionar prestador');
      throw error;
    }
  };

  // Função para renomear prestador
  const updatePrestador = async (id: string, novoNome: string) => {
    try {
      const { error } = await supabase
        .from('prestadores_servico')
        .update({ nome: novoNome })
        .eq('id', id);

      if (error) throw error;

      setPrestadores(prev =>
        prev.map(p => p.id === id ? { ...p, nome: novoNome } : p)
      );
      toast.success('Responsável atualizado com sucesso');
    } catch (error) {
      console.error('Erro ao atualizar prestador:', error);
      toast.error('Erro ao atualizar responsável');
      throw error;
    }
  };

  // Função para excluir prestador logicamente (ativo = false) ou fisicamente se preferir 
  // O prompt pede: "remova o responsável do banco de dados"
  // "Implemente a exclusão mesmo que o responsável esteja vinculado a lotes antigos"
  // Como é campo string na Producao, excluir não quebra, então removeremos fisicamente.
  const deletePrestador = async (id: string) => {
    try {
      const { error } = await supabase
        .from('prestadores_servico')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPrestadores(prev => prev.filter(p => p.id !== id));
      toast.success('Responsável removido');
    } catch (error) {
      console.error('Erro ao excluir prestador:', error);
      toast.error('Erro ao excluir responsável');
      throw error;
    }
  };

  return {
    prestadores,       // Todos os prestadores do banco
    prestadoresFiltrados, // Filtrados por etapaAtual
    todosResponsaveis, // Padrão + banco 
    loading,
    addPrestador,
    updatePrestador,
    deletePrestador,
    refetch: fetchPrestadores
  };
}
