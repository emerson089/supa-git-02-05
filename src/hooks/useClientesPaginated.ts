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
  categoria?: string;
  total_comprado?: number;
  data_ultima_compra?: string;
  opt_out?: boolean;
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

  // Use a fingerprint of the actual IDs (not just the length) to avoid cache collisions
  // when two different CRM filters happen to return the same number of clients.
  const filterKey = filterByIds == null
    ? filterByIds
    : filterByIds.length === 0
      ? '[]'
      : [...filterByIds].sort().join(',');

  return useQuery<ClientesPaginatedResult>({
    queryKey: ['clientes-paginated', user?.id, page, pageSize, debouncedSearch, ordenacao, filterKey],
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

      // Threshold: how many IDs we can safely cram into a single .in(...) clause
      // before the PostgREST URL becomes too long (limit ~8KB; each UUID ~ 38 chars).
      const IN_CHUNK_SIZE = 150;

      // ============================================================
      // CRM filter path (filterByIds set): we may need many chunked
      // requests + local sort + local pagination.
      // ============================================================
      if (filterByIds) {
        const ids = filterByIds;
        let totalCount = ids.length;
        let finalIds = ids;

        if (debouncedSearch) {
          const matchingIds: string[] = [];
          const searchTerm = `%${debouncedSearch}%`;
          const searchClause = `nome.ilike.${searchTerm},telefone.ilike.${searchTerm},cidade.ilike.${searchTerm},excursao.ilike.${searchTerm}`;

          for (let i = 0; i < ids.length; i += IN_CHUNK_SIZE) {
            const chunk = ids.slice(i, i + IN_CHUNK_SIZE);
            const { data, error } = await supabase
              .from('clientes')
              .select('id')
              .eq('user_id', user.id)
              .in('id', chunk)
              .or(searchClause);

            if (error) throw error;
            if (data) matchingIds.push(...data.map(d => d.id));
          }
          
          const idToIndexMap = new Map<string, number>();
          ids.forEach((id, index) => idToIndexMap.set(id, index));
          matchingIds.sort((a, b) => (idToIndexMap.get(a) ?? 0) - (idToIndexMap.get(b) ?? 0));
          
          finalIds = matchingIds;
          totalCount = matchingIds.length;
        }

        const pageIds = finalIds.slice(from, from + pageSize);
        
        let pageData: ClientePaginatedDB[] = [];
        if (pageIds.length > 0) {
          const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .in('id', pageIds);
          
          if (error) throw error;
          
          if (data) {
            const pageIdToIndexMap = new Map<string, number>();
            pageIds.forEach((id, index) => pageIdToIndexMap.set(id, index));
            pageData = [...data].sort((a, b) => 
              (pageIdToIndexMap.get(a.id) ?? 0) - (pageIdToIndexMap.get(b.id) ?? 0)
            ) as ClientePaginatedDB[];
          }
        }

        const totalPages = Math.ceil(totalCount / pageSize);

        return {
          data: pageData,
          count: totalCount,
          totalPages,
        };
      }

      // ============================================================
      // No CRM filter: standard server-side query with count + range
      // ============================================================
      let countQuery = (supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true }) as any)
        .eq('user_id', user.id);

      let dataQuery = (supabase
        .from('clientes')
        .select('*') as any)
        .eq('user_id', user.id);

      if (debouncedSearch) {
        const searchTerm = `%${debouncedSearch}%`;
        const searchClause = `nome.ilike.${searchTerm},telefone.ilike.${searchTerm},cidade.ilike.${searchTerm},excursao.ilike.${searchTerm}`;
        countQuery = countQuery.or(searchClause);
        dataQuery = dataQuery.or(searchClause);
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
    // Don't run while a CRM filter is still loading (filterByIds = undefined means loading)
    enabled: !!user?.id && params.filterByIds !== undefined,
    staleTime: 30000, // Cache for 30 seconds
  });
}
