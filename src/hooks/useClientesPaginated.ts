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

        // Helper: fetch all matching client rows in chunks of IN_CHUNK_SIZE
        const fetchAllByIds = async () => {
          const results: any[] = [];
          for (let i = 0; i < ids.length; i += IN_CHUNK_SIZE) {
            const chunk = ids.slice(i, i + IN_CHUNK_SIZE);
            let q = (supabase
              .from('clientes')
              .select('*') as any)
              .eq('user_id', user.id)
              .in('id', chunk);

            if (debouncedSearch) {
              const searchTerm = `%${debouncedSearch}%`;
              const searchClause = `nome.ilike.${searchTerm},telefone.ilike.${searchTerm},cidade.ilike.${searchTerm},excursao.ilike.${searchTerm}`;
              q = q.or(searchClause);
            }

            // Always cap per-chunk to PostgREST default 1000 (chunk size is well below).
            const { data, error } = await q;
            if (error) throw error;
            if (data && data.length) results.push(...data);
          }
          return results;
        };

        const allData = await fetchAllByIds();

        // Sort locally respecting the exact order of filterByIds
        // (preserves CRM priority like "oldest pending first" or "maior_historico")
        const idToIndexMap = new Map<string, number>();
        ids.forEach((id, index) => idToIndexMap.set(id, index));

        allData.sort((a, b) => {
          const indexA = idToIndexMap.has(a.id) ? idToIndexMap.get(a.id)! : 999999;
          const indexB = idToIndexMap.has(b.id) ? idToIndexMap.get(b.id)! : 999999;
          return indexA - indexB;
        });

        const totalCount = allData.length;
        const totalPages = Math.ceil(totalCount / pageSize);
        const paginatedData = allData.slice(from, from + pageSize) as any[];

        return {
          data: paginatedData,
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
