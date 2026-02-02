

## Plano: Persistência de Busca e Métricas Dinâmicas no Estoque

### Problema 1: Persistência da Busca

A busca já está sendo persistida via URL params (`?q=termo`), mas ao navegar para outra página e retornar, o termo de busca deveria permanecer. Vou verificar e garantir que isso funcione corretamente.

**Diagnóstico**: A lógica atual já usa `useSearchParams` corretamente. O problema pode estar no `<BrowserRouter>` ou na forma como os links navegam.

### Problema 2: Métricas Não Refletem a Busca

Os cards de resumo (Total Peças, Valor Total, Em Alerta, Esgotados) atualmente mostram dados de **todos os itens**, não apenas dos itens que correspondem à busca.

**Solução**: Modificar o hook `useEstoqueMetrics` para aceitar o parâmetro `search` e filtrar os resultados de acordo.

---

### Alterações Propostas

#### Arquivo 1: `src/hooks/useEstoqueItensPaginated.ts`

Adicionar o parâmetro `search` ao hook `useEstoqueMetrics`:

```typescript
// Hook para obter métricas agregadas (para os cards de resumo)
export function useEstoqueMetrics(tipo?: 'materia-prima' | 'acabado', search?: string) {
  const { user } = useAuth();
  const debouncedSearch = useDebouncedValue(search || '', 300);
  
  return useQuery({
    queryKey: ['estoque-metrics', user?.id, tipo, debouncedSearch],
    queryFn: async () => {
      if (!user) return { totalPecas: 0, valorTotal: 0, itensAlerta: 0, itensEsgotados: 0, totalItens: 0 };
      
      // Buscar local Central
      const { data: localCentral } = await supabase
        .from('estoque_locais')
        .select('id')
        .eq('user_id', user.id)
        .eq('tipo', 'central')
        .maybeSingle();
      
      // Buscar campos necessários para métricas
      let query = supabase
        .from('estoque_itens')
        .select('id, nome, categoria, quantidade, preco_unitario')
        .eq('user_id', user.id);
      
      if (tipo) {
        query = query.eq('tipo', tipo);
      }
      
      // NOVO: Aplicar filtro de busca
      if (debouncedSearch) {
        query = query.or(`nome.ilike.%${debouncedSearch}%,categoria.ilike.%${debouncedSearch}%`);
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
      
      // Calcular métricas
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
    staleTime: 30000,
  });
}
```

---

#### Arquivo 2: `src/pages/Estoque.tsx`

Passar o parâmetro `search` para o hook `useEstoqueMetrics`:

**Antes (linha ~163):**
```typescript
const { data: metrics } = useEstoqueMetrics(tipoEstoque);
```

**Depois:**
```typescript
const { data: metrics } = useEstoqueMetrics(tipoEstoque, search);
```

---

### Comportamento Esperado

| Cenário | Indicadores |
|---------|-------------|
| Sem busca | Mostram totais de todos os itens do tipo |
| Busca "calça" | Mostram totais apenas dos itens com "calça" no nome ou categoria |
| Busca "164" | Mostram métricas apenas dos itens que contêm "164" |

---

### Resultado Visual

Ao pesquisar por um termo:
- **Total Peças**: Soma das quantidades dos itens filtrados
- **Valor Total**: Soma do valor (preço × quantidade) dos itens filtrados  
- **Em Alerta**: Contagem de itens filtrados com estoque baixo (1-20)
- **Esgotados**: Contagem de itens filtrados com quantidade = 0

---

### Resumo de Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useEstoqueItensPaginated.ts` | Adicionar parâmetro `search` ao hook `useEstoqueMetrics` (linhas 240-314) |
| `src/pages/Estoque.tsx` | Passar `search` para `useEstoqueMetrics` (linha ~163) |

