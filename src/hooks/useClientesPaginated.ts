import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

export interface ClientePaginatedDB {
  id: string;
  nome: string;
  telefone: string;
  cidade: string;
  estado: string;
  excursao: string;
  created_at: string;
  user_id: string;
}

export interface ClientesPaginatedParams {
  page: number;
  pageSize: number;
  search?: string;
  ordenacao?: 'nome' | 'recente';
}

export interface ClientesPaginatedResult {
  data: ClientePaginatedDB[];
  count: number;
  totalPages: number;
}

export function useClientesPaginated(params: ClientesPaginatedParams) {
  const { user } = useAuth();
  const { page, pageSize, search = '', ordenacao = 'nome' } = params;
  
  // Debounce search by 400ms
  const debouncedSearch = useDebouncedValue(search, 400);

  return useQuery<ClientesPaginatedResult>({
    queryKey: ['clientes-paginated', user?.id, page, pageSize, debouncedSearch, ordenacao],
    queryFn: async () => {
      if (!user?.id) {
        return { data: [], count: 0, totalPages: 0 };
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;

      // Build base query with count
      let countQuery = supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      let dataQuery = supabase
        .from('clientes')
        .select('id, nome, telefone, cidade, estado, excursao, created_at, user_id')
        .eq('user_id', user.id);

      // Apply search filter (server-side)
      if (debouncedSearch) {
        const searchTerm = `%${debouncedSearch}%`;
        countQuery = countQuery.or(
          `nome.ilike.${searchTerm},telefone.ilike.${searchTerm},cidade.ilike.${searchTerm},excursao.ilike.${searchTerm}`
        );
        dataQuery = dataQuery.or(
          `nome.ilike.${searchTerm},telefone.ilike.${searchTerm},cidade.ilike.${searchTerm},excursao.ilike.${searchTerm}`
        );
      }

      // Apply sorting (server-side)
      if (ordenacao === 'recente') {
        dataQuery = dataQuery.order('created_at', { ascending: false });
      } else {
        dataQuery = dataQuery.order('nome', { ascending: true });
      }

      // Apply pagination
      dataQuery = dataQuery.range(from, to);

      // Execute both queries in parallel
      const [countResult, dataResult] = await Promise.all([
        countQuery,
        dataQuery,
      ]);

      if (countResult.error) throw countResult.error;
      if (dataResult.error) throw dataResult.error;

      const totalCount = countResult.count || 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        data: dataResult.data || [],
        count: totalCount,
        totalPages,
      };
    },
    enabled: !!user?.id,
    staleTime: 30000, // Cache for 30 seconds
  });
}
