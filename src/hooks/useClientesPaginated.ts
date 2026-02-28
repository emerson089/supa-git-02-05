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
  ordenacao?: 'nome' | 'recente' | 'maior_historico';
  filterByIds?: string[] | null; // Filter by specific client IDs (for CRM filters)
}

export interface ClientesPaginatedResult {
  data: ClientePaginatedDB[];
  count: number;
  totalPages: number;
}

export function useClientesPaginated(params: ClientesPaginatedParams) {
  const { user } = useAuth();
  const { page, pageSize, search = '', ordenacao = 'nome', filterByIds } = params;

  // Debounce search by 400ms
  const debouncedSearch = useDebouncedValue(search, 400);

  return useQuery<ClientesPaginatedResult>({
    queryKey: ['clientes-paginated', user?.id, page, pageSize, debouncedSearch, ordenacao, filterByIds?.length ?? null],
    queryFn: async () => {
      if (!user?.id) {
        return { data: [], count: 0, totalPages: 0 };
      }

      // If filterByIds is an empty array, return empty results (filter active but no matches)
      if (filterByIds !== null && filterByIds !== undefined && filterByIds.length === 0) {
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

      // Apply ID filter BEFORE pagination (for CRM filters like Pendentes, VIP, etc.)
      if (filterByIds && filterByIds.length > 0) {
        countQuery = countQuery.in('id', filterByIds);
        dataQuery = dataQuery.in('id', filterByIds);
      }

      // Apply search filter (server-side)
      if (debouncedSearch) {
        const searchTerm = `%${debouncedSearch}%`;
        const searchClause = `nome.ilike.${searchTerm},telefone.ilike.${searchTerm},cidade.ilike.${searchTerm},excursao.ilike.${searchTerm}`;
        countQuery = countQuery.or(searchClause);
        dataQuery = dataQuery.or(searchClause);
      }

      // If we are filtering by CRM IDs, doing Server-Side sorting/pagination ruins out custom
      // frontend order (like "highest days without purchase" or "maior_historico").
      // So we fetch all matching rows, sort them by filterByIds, and paginate locally.
      if (filterByIds) {
        // Execute queries (no range)
        const [countResult, dataResult] = await Promise.all([
          countQuery,
          dataQuery,
        ]);

        if (countResult.error) throw countResult.error;
        if (dataResult.error) throw dataResult.error;

        let allData = dataResult.data || [];

        // Sort locally respecting the exact order of filterByIds
        allData.sort((a, b) => {
          return filterByIds.indexOf(a.id) - filterByIds.indexOf(b.id);
        });

        // Apply pagination locally
        const totalCount = allData.length;
        const totalPages = Math.ceil(totalCount / pageSize);
        const paginatedData = allData.slice(from, to);

        return {
          data: paginatedData,
          count: totalCount,
          totalPages,
        };
      }

      // NO CRM filter: Apply normal server-side sorting and pagination
      if (ordenacao === 'recente') {
        dataQuery = dataQuery.order('created_at', { ascending: false });
      } else {
        dataQuery = dataQuery.order('nome', { ascending: true });
      }

      dataQuery = dataQuery.range(from, to);

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
