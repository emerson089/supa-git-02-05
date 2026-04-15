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
  quantidadeInicial: number;
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
  quantidade_inicial: number;
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
  quantidadeInicial: Number(dbItem.quantidade_inicial || 0),
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
        .eq('user_id', user.id)
        .neq('categoria', 'Variação Padronizada');

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
        .neq('categoria', 'Variação Padronizada')
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
        let items = (data as any[]).map(mapDbItemToItem);
        
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
        
        // Para filtros dinâmicos, buscamos também todas as variações para agregar
        const { data: allVariations } = await supabase
          .from('estoque_itens')
          .select('id, quantidade, localizacao')
          .eq('user_id', user.id)
          .eq('categoria', 'Variação Padronizada')
          .eq('tipo', params.tipo);

        let items = (data as any[]).map(mapDbItemToItem);
        
        // Get quantities from Central if available
        if (localCentral) {
          const itemIds = [...items.map(i => i.id), ...(allVariations?.map(v => v.id) || [])];
          
          if (itemIds.length > 0) {
            // Se houver muitos IDs, o Supabase pode reclamar de query longa. 
            // Mas aqui buscamos todos os registros de Central de uma vez (limitado ao user_id)
            const { data: estoquePorLocal } = await supabase
              .from('estoque_por_local')
              .select('item_id, quantidade')
              .eq('local_id', localCentral.id);
            
            const quantidadeMap = new Map<string, number>();
            if (estoquePorLocal) {
              estoquePorLocal.forEach(epl => {
                quantidadeMap.set(epl.item_id, Number(epl.quantidade));
              });
            }
            
            // Map de soma para pais
            const parentSums = new Map<string, number>();
            
            // Somar variações
            allVariations?.forEach(v => {
              let pId = '';
              try {
                const loc = JSON.parse(v.localizacao || '{}');
                pId = loc.modeloId;
              } catch(e) {}
              
              if (pId) {
                const vQty = quantidadeMap.get(v.id) ?? Number(v.quantidade);
                parentSums.set(pId, (parentSums.get(pId) || 0) + vQty);
              }
            });

            items = items.map(item => {
              let qty = item.quantidade;
              if (item.categoria === 'Modelo Padronizado') {
                qty = parentSums.get(item.id) ?? 0;
              } else {
                qty = quantidadeMap.get(item.id) ?? item.quantidade;
              }
              return { ...item, quantidade: qty };
            });
          }
        }
        
        // Apply quantity filter
        if (params.filtroRapido === 'esgotado') {
          items = items.filter(item => item.quantidade <= 0);
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
export function useEstoqueMetrics(tipo?: 'materia-prima' | 'acabado', search?: string) {
  const { user } = useAuth();
  const debouncedSearch = useDebouncedValue(search || '', 300);
  
  return useQuery({
    queryKey: ['estoque-metrics', user?.id, tipo, debouncedSearch],
    queryFn: async () => {
      if (!user) return { totalPecas: 0, valorTotal: 0, itensAlerta: 0, itensEsgotados: 0, totalItens: 0, totalProduzido: 0 };
      
      // Buscar local Central
      const { data: localCentral } = await supabase
        .from('estoque_locais')
        .select('id')
        .eq('user_id', user.id)
        .eq('tipo', 'central')
        .maybeSingle();
      
      // Buscar TODOS os itens para agregação dinâmica
      // Não filtramos categoria aqui para podermos somar variações aos pais
      let query = supabase
        .from('estoque_itens')
        .select('id, nome, categoria, quantidade, preco_unitario, localizacao, quantidade_inicial')
        .eq('user_id', user.id);

      if (tipo) {
        query = query.eq('tipo', tipo);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      if (!data) return { totalPecas: 0, valorTotal: 0, itensAlerta: 0, itensEsgotados: 0, totalItens: 0, totalProduzido: 0 };
      
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
      
      // Agregação baseada em cards (Pai ou Manual)
      const cards = new Map<string, {
        id: string;
        nome: string;
        categoria: string;
        quantidade: number;
        preco: number;
        isPadronizado: boolean;
        quantidadeInicial: number;
      }>();

      const items = (data as any[]);
      const variations = items.filter(i => i.categoria === 'Variação Padronizada');
      const parentsAndManuals = items.filter(i => i.categoria !== 'Variação Padronizada');

      // 1. Inicializar cards com Pais e Manuais
      parentsAndManuals.forEach(item => {
        cards.set(item.id, {
          id: item.id,
          nome: item.nome,
          categoria: item.categoria,
          quantidade: item.categoria === 'Modelo Padronizado' ? 0 : (quantidadeMap.get(item.id) ?? Number(item.quantidade)),
          preco: Number(item.preco_unitario) || 0,
          isPadronizado: item.categoria === 'Modelo Padronizado',
          quantidadeInicial: Number(item.quantidade_inicial || 0)
        });
      });

      // 2. Somar variações aos pais
      variations.forEach(v => {
        let parentId = '';
        try {
          const loc = JSON.parse(v.localizacao || '{}');
          parentId = loc.modeloId;
        } catch (e) {}

        if (parentId && cards.has(parentId)) {
          const parent = cards.get(parentId)!;
          const vQty = quantidadeMap.get(v.id) ?? Number(v.quantidade);
          parent.quantidade += vQty;
        }
      });

      let totalPecas = 0;
      let valorTotal = 0;
      let itensAlerta = 0;
      let itensEsgotados = 0;
      let totalProduzido = 0;
      let filteredCount = 0;

      // 3. Calcular métricas sobre os cards agregados
      cards.forEach(card => {
        // Ignorar se não bater no filtro de busca
        if (debouncedSearch) {
          const searchLower = debouncedSearch.toLowerCase();
          const matches = card.nome.toLowerCase().includes(searchLower) || 
                         card.categoria.toLowerCase().includes(searchLower);
          if (!matches) return;
        }

        filteredCount++;
        const qty = card.quantidade;
        const preco = card.preco;
        
        totalPecas += qty;
        valorTotal += preco * qty;
        totalProduzido += card.quantidadeInicial || qty;
        
        if (qty <= 0) {
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
        totalItens: filteredCount,
        totalProduzido,
      };
    },
    enabled: !!user,
    staleTime: 30000,
  });
}
