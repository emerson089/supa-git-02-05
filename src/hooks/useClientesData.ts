import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ClienteDB {
  id: string;
  user_id: string;
  nome: string;
  telefone: string;
  cidade: string;
  estado: string;
  excursao: string;
  created_at: string;
  updated_at: string;
}

export type ClienteInsert = Omit<ClienteDB, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type ClienteInsertWithDate = ClienteInsert & { created_at?: string };
export type ClienteUpdate = Partial<ClienteInsert>;

export function useClientes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['clientes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ClienteDB[];
    },
    enabled: !!user,
  });
}

export function useAddCliente() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (cliente: ClienteInsertWithDate) => {
      if (!user) throw new Error('User not authenticated');

      const insertData: {
        nome: string;
        telefone: string;
        cidade: string;
        estado: string;
        excursao: string;
        user_id: string;
        created_at?: string;
      } = {
        nome: cliente.nome,
        telefone: cliente.telefone,
        cidade: cliente.cidade,
        estado: cliente.estado,
        excursao: cliente.excursao,
        user_id: user.id,
      };

      // Include created_at if provided
      if (cliente.created_at) {
        insertData.created_at = cliente.created_at;
      }

      const { data, error } = await supabase
        .from('clientes')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data as ClienteDB;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}

export function useUpdateCliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ClienteUpdate }) => {
      const { data: updated, error } = await supabase
        .from('clientes')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated as ClienteDB;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}

export function useRemoveCliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}
