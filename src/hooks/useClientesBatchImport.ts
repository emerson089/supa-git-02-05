import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ClienteDB, ClienteInsertWithDate } from './useClientesData';

const BATCH_SIZE = 100;

interface BatchImportResult {
  imported: ClienteDB[];
  total: number;
}

interface BatchImportOptions {
  onProgress?: (imported: number, total: number) => void;
}

export function useClientesBatchImport(options?: BatchImportOptions) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (clientes: ClienteInsertWithDate[]): Promise<BatchImportResult> => {
      if (!user) throw new Error('User not authenticated');
      
      const results: ClienteDB[] = [];
      const total = clientes.length;
      
      for (let i = 0; i < clientes.length; i += BATCH_SIZE) {
        const batch = clientes.slice(i, i + BATCH_SIZE).map(c => ({
          nome: c.nome,
          telefone: c.telefone,
          cidade: c.cidade,
          estado: c.estado,
          excursao: c.excursao,
          user_id: user.id,
          ...(c.created_at && { created_at: c.created_at }),
        }));
        
        const { data, error } = await supabase
          .from('clientes')
          .insert(batch)
          .select();
        
        if (error) throw error;
        
        results.push(...(data as ClienteDB[]));
        
        // Report progress after each batch
        options?.onProgress?.(results.length, total);
      }
      
      return { imported: results, total };
    },
    onSuccess: () => {
      // Invalidate cache only ONCE at the end
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });
}
