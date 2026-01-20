import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

export type TipoEstoque = 'materia-prima' | 'acabado';
export type FiltroRapido = 'todos' | 'esgotado' | 'baixo';

export interface ItemEstoquePaginated {
  id: string;
  nome: string;
  tipo: TipoEstoque;
  categoria: string;
  quantidade: number;
  unidade: string;
  quantidadeMinima: number;
  precoUnitario: number;
  localizacao: string | null;
  imagemUrl: string | null;
  producaoId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EstoquePaginatedParams {
  page: number;
  pageSize: number;
  search?: string;
  tipo?: 'materia-prima' | 'acabado';
  filtroRapido?: FiltroRapido;
}

export interface EstoquePaginatedResult {
  data: ItemEstoquePaginated[];
  totalCount: number;
  totalPages: number;
}

interface DbItem {
  id: string;
  nome: string;
  tipo: string;
  categoria: string;
  quantidade: number;
  unidade: string;
  quantidade_minima: number;
  preco_unitario: number | null;
  localizacao: string | null;
  imagem_url: string | null;
  producao_id: string | null;
  created_at: string;
  updated_at: string;
}

const mapDbItemToItem = (dbItem: DbItem): ItemEstoquePaginated => ({
  id: dbItem.id,
  nome: dbItem.nome,
  tipo: dbItem.tipo as TipoEstoque,
  categoria: dbItem.categoria,
  quantidade: Number(dbItem.quantidade),
  unidade: dbItem.unidade,
  quantidadeMinima: Number(dbItem.quantidade_minima),
  precoUnitario: dbItem.preco_unitario ? Number(dbItem.preco_unitario) : 0,
  localizacao: dbItem.localizacao,
  imagemUrl: dbItem.imagem_url,
  producaoId: dbItem.producao_id,
  createdAt: dbItem.created_at,
  updatedAt: dbItem.updated_at,
});

export function useEstoqueItensPaginated(params: EstoquePaginatedParams) {
  const { user } = useAuth();
  const debouncedSearch = useDebouncedValue(params.search || '', 300);
  
  return useQuery({
    queryKey: [
      'estoque-itens-paginated', 
      user?.id, 
      params.page, 
      params.pageSize, 
      debouncedSearch, 
      params.tipo, 
      params.filtroRapido
    ],
    queryFn: async (): Promise<EstoquePaginatedResult> => {
      if (!user) return { data: [], totalCount: 0, totalPages: 0 };
      
      // 1. Buscar o local Central do usuário para obter quantidades corretas
      const { data: localCentral } = await supabase
        .from('estoque_locais')
        .select('id')
        .eq('user_id', user.id)
        .eq('tipo', 'central')
        .maybeSingle();

      // 2. Build base query for count
      let countQuery = supabase
        .from('estoque_itens')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      // Apply tipo filter
      if (params.tipo) {
        countQuery = countQuery.eq('tipo', params.tipo);
      }
      
      // Apply search filter
      if (debouncedSearch) {
        countQuery = countQuery.or(`nome.ilike.%${debouncedSearch}%,categoria.ilike.%${debouncedSearch}%`);
      }
      
      // Apply quick filter (esgotado/baixo)
      // Note: These will be applied after we get quantities from estoque_por_local
      // For now, we need to get all matching items and filter in memory for quantity-based filters
      // This is a tradeoff - for better performance with large datasets, a DB view would be ideal
      
      // 3. Build data query
      let dataQuery = supabase
        .from('estoque_itens')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      // Apply tipo filter
      if (params.tipo) {
        dataQuery = dataQuery.eq('tipo', params.tipo);
      }
      
      // Apply search filter
      if (debouncedSearch) {
        dataQuery = dataQuery.or(`nome.ilike.%${debouncedSearch}%,categoria.ilike.%${debouncedSearch}%`);
      }

      // For quantity-based filters, we need to fetch all and filter
      // For 'todos', we can use proper pagination
      if (params.filtroRapido === 'todos' || !params.filtroRapido) {
        // Get count first
        const { count: totalCount, error: countError } = await countQuery;
        if (countError) throw countError;
        
        // Apply pagination
        const from = params.page * params.pageSize;
        const to = from + params.pageSize - 1;
        dataQuery = dataQuery.range(from, to);
        
        const { data, error } = await dataQuery;
        if (error) throw error;
        if (!data) return { data: [], totalCount: 0, totalPages: 0 };
        
        // Get quantities from Central if available
        let items = (data as DbItem[]).map(mapDbItemToItem);
        
        if (localCentral) {
          const itemIds = items.map(i => i.id);
          const { data: estoquePorLocal } = await supabase
            .from('estoque_por_local')
            .select('item_id, quantidade')
            .eq('local_id', localCentral.id)
            .in('item_id', itemIds);
          
          const quantidadeMap = new Map<string, number>();
          if (estoquePorLocal) {
            estoquePorLocal.forEach(epl => {
              quantidadeMap.set(epl.item_id, Number(epl.quantidade));
            });
          }
          
          items = items.map(item => ({
            ...item,
            quantidade: quantidadeMap.has(item.id) ? quantidadeMap.get(item.id)! : item.quantidade,
          }));
        }
        
        return {
          data: items,
          totalCount: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / params.pageSize),
        };
      } else {
        // For esgotado/baixo filters, we need to fetch all items and filter by quantity
        // Then apply pagination in memory
        const { data, error } = await dataQuery;
        if (error) throw error;
        if (!data) return { data: [], totalCount: 0, totalPages: 0 };
        
        let items = (data as DbItem[]).map(mapDbItemToItem);
        
        // Get quantities from Central if available
        if (localCentral) {
          const itemIds = items.map(i => i.id);
          if (itemIds.length > 0) {
            const { data: estoquePorLocal } = await supabase
              .from('estoque_por_local')
              .select('item_id, quantidade')
              .eq('local_id', localCentral.id)
              .in('item_id', itemIds);
            
            const quantidadeMap = new Map<string, number>();
            if (estoquePorLocal) {
              estoquePorLocal.forEach(epl => {
                quantidadeMap.set(epl.item_id, Number(epl.quantidade));
              });
            }
            
            items = items.map(item => ({
              ...item,
              quantidade: quantidadeMap.has(item.id) ? quantidadeMap.get(item.id)! : item.quantidade,
            }));
          }
        }
        
        // Apply quantity filter
        if (params.filtroRapido === 'esgotado') {
          items = items.filter(item => item.quantidade === 0);
        } else if (params.filtroRapido === 'baixo') {
          items = items.filter(item => item.quantidade > 0 && item.quantidade <= 20);
        }
        
        const totalCount = items.length;
        
        // Apply pagination in memory
        const from = params.page * params.pageSize;
        const to = from + params.pageSize;
        items = items.slice(from, to);
        
        return {
          data: items,
          totalCount,
          totalPages: Math.ceil(totalCount / params.pageSize),
        };
      }
    },
    enabled: !!user,
    staleTime: 15000,
    placeholderData: (previousData) => previousData,
  });
}

// Hook para obter métricas agregadas (para os cards de resumo)
export function useEstoqueMetrics(tipo?: 'materia-prima' | 'acabado') {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['estoque-metrics', user?.id, tipo],
    queryFn: async () => {
      if (!user) return { totalPecas: 0, valorTotal: 0, itensAlerta: 0, itensEsgotados: 0, totalItens: 0 };
      
      // Buscar local Central
      const { data: localCentral } = await supabase
        .from('estoque_locais')
        .select('id')
        .eq('user_id', user.id)
        .eq('tipo', 'central')
        .maybeSingle();
      
      // Buscar apenas campos necessários para métricas
      let query = supabase
        .from('estoque_itens')
        .select('id, quantidade, preco_unitario')
        .eq('user_id', user.id);
      
      if (tipo) {
        query = query.eq('tipo', tipo);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      if (!data) return { totalPecas: 0, valorTotal: 0, itensAlerta: 0, itensEsgotados: 0, totalItens: 0 };
      
      // Get quantities from Central
      let quantidadeMap = new Map<string, number>();
      if (localCentral) {
        const { data: estoquePorLocal } = await supabase
          .from('estoque_por_local')
          .select('item_id, quantidade')
          .eq('local_id', localCentral.id);
        
        if (estoquePorLocal) {
          estoquePorLocal.forEach(epl => {
            quantidadeMap.set(epl.item_id, Number(epl.quantidade));
          });
        }
      }
      
      let totalPecas = 0;
      let valorTotal = 0;
      let itensAlerta = 0;
      let itensEsgotados = 0;
      
      data.forEach(item => {
        const qty = quantidadeMap.has(item.id) ? quantidadeMap.get(item.id)! : Number(item.quantidade);
        const preco = Number(item.preco_unitario) || 0;
        
        totalPecas += qty;
        valorTotal += preco * qty;
        
        if (qty === 0) {
          itensEsgotados++;
        } else if (qty <= 20) {
          itensAlerta++;
        }
      });
      
      return {
        totalPecas,
        valorTotal,
        itensAlerta,
        itensEsgotados,
        totalItens: data.length,
      };
    },
    enabled: !!user,
    staleTime: 30000, // 30 seconds
  });
}
