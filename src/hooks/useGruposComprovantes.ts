import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

export type ComprovanteCategoria = Database['public']['Enums']['comprovante_categoria'];

export interface GrupoComprovante {
  id: string;
  user_id: string;
  group_whatsapp_id: string;
  nome: string;
  emoji: string;
  cor: string;
  categoria_padrao: ComprovanteCategoria;
  pedir_legenda_ja: boolean;
  aceita_pdf: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventoBruto {
  id: string;
  group_whatsapp_id: string | null;
  sender: string | null;
  chat_name: string | null;
  message_type: string | null;
  caption: string | null;
  payload: any;
  created_at: string;
}

export const CORES_GRUPO = [
  { value: 'emerald', label: 'Verde Esmeralda' },
  { value: 'blue', label: 'Azul' },
  { value: 'purple', label: 'Roxo' },
  { value: 'amber', label: 'Âmbar' },
  { value: 'rose', label: 'Rosa' },
  { value: 'sky', label: 'Azul Céu' },
  { value: 'indigo', label: 'Índigo' },
  { value: 'orange', label: 'Laranja' },
];

export function useGruposComprovantes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['grupos-comprovantes', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('grupos_comprovantes')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as GrupoComprovante[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: async (input: Omit<GrupoComprovante, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user?.id) throw new Error('Não autenticado');
      const { data, error } = await (supabase as any)
        .from('grupos_comprovantes')
        .insert({ ...input, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as GrupoComprovante;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grupos-comprovantes'] });
      toast.success('Grupo cadastrado!');
    },
    onError: (e: any) => {
      console.error(e);
      toast.error(e?.message?.includes('duplicate') ? 'Esse ID de grupo já está cadastrado.' : 'Erro ao cadastrar grupo.');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<GrupoComprovante> }) => {
      const { data, error } = await (supabase as any)
        .from('grupos_comprovantes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as GrupoComprovante;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grupos-comprovantes'] });
      toast.success('Grupo atualizado!');
    },
    onError: (e: any) => {
      console.error(e);
      toast.error('Erro ao atualizar grupo.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('grupos_comprovantes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grupos-comprovantes'] });
      toast.success('Grupo removido.');
    },
    onError: (e: any) => {
      console.error(e);
      toast.error('Erro ao remover grupo.');
    }
  });

  return {
    grupos: query.data || [],
    loading: query.isLoading,
    refetch: query.refetch,
    createGrupo: createMutation.mutate,
    updateGrupo: updateMutation.mutate,
    deleteGrupo: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}

/**
 * Lista group_ids descobertos no webhook que ainda NÃO estão cadastrados.
 * Usado no modal de cadastro pra facilitar descoberta.
 */
export function useEventosBrutosNaoCadastrados() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['eventos-brutos-nao-cadastrados', user?.id],
    queryFn: async () => {
      // Pega últimos eventos
      const { data: eventos, error } = await (supabase as any)
        .from('webhook_eventos_brutos')
        .select('group_whatsapp_id, chat_name, message_type, created_at')
        .not('group_whatsapp_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      // Pega grupos já cadastrados
      const { data: cadastrados } = await (supabase as any)
        .from('grupos_comprovantes')
        .select('group_whatsapp_id');

      const idsCadastrados = new Set((cadastrados || []).map((g: any) => g.group_whatsapp_id));

      // Agrupa por group_id, contagem e último visto
      const map = new Map<string, { group_whatsapp_id: string; chat_name: string | null; ultima_msg: string; total: number }>();

      for (const e of (eventos || []) as any[]) {
        if (!e.group_whatsapp_id || idsCadastrados.has(e.group_whatsapp_id)) continue;
        const existing = map.get(e.group_whatsapp_id);
        if (!existing) {
          map.set(e.group_whatsapp_id, {
            group_whatsapp_id: e.group_whatsapp_id,
            chat_name: e.chat_name,
            ultima_msg: e.created_at,
            total: 1,
          });
        } else {
          existing.total += 1;
          if (!existing.chat_name && e.chat_name) existing.chat_name = e.chat_name;
        }
      }

      return Array.from(map.values()).sort((a, b) => b.ultima_msg.localeCompare(a.ultima_msg));
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

/**
 * Mapa rápido group_whatsapp_id -> GrupoComprovante (para chips na tabela)
 */
export function useGruposMap() {
  const { grupos } = useGruposComprovantes();
  const map = new Map<string, GrupoComprovante>();
  for (const g of grupos) map.set(g.group_whatsapp_id, g);
  return map;
}

// Mapa de classes de cor (Tailwind safelist via classes literais)
export const COR_CLASSES: Record<string, { bg: string; text: string; border: string; chip: string }> = {
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-900/50', chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50' },
  blue: { bg: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-900/50', chip: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-900/50' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-900/50', chip: 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 border-purple-200 dark:border-purple-900/50' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-900/50', chip: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-900/50' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-900/50', chip: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 dark:border-rose-900/50' },
  sky: { bg: 'bg-sky-500', text: 'text-sky-700 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-900/50', chip: 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400 border-sky-200 dark:border-sky-900/50' },
  indigo: { bg: 'bg-indigo-500', text: 'text-indigo-700 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-900/50', chip: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-900/50', chip: 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 border-orange-200 dark:border-orange-900/50' },
};

export function getCorClasses(cor: string) {
  return COR_CLASSES[cor] || COR_CLASSES.emerald;
}
