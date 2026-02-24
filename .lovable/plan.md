

## Otimizacao de Consumo de Cloud

### Diagnostico dos principais pontos de consumo

| Problema | Impacto |
|---|---|
| **PedidosProvider global** busca TODOS os pedidos + TODOS os pedido_itens em TODAS as paginas | ~6+ requests pesadas por navegacao |
| **ClientesProvider global** busca TODOS os clientes em TODAS as paginas | ~2+ requests por navegacao |
| **EstoqueProvider global** busca TODOS os itens + TODAS as movimentacoes em TODAS as paginas | ~3+ requests por navegacao |
| **Dashboard sem cache** usa useEffect/useState, refaz 12 queries paralelas toda vez que o usuario navega de volta | 12 queries por revisita |
| **useEstoqueMovimentacoes** busca TODAS as movimentacoes sem limite, carregado globalmente | 1 query pesada sem necessidade |
| **useDisponivelCentral** chama useEstoquePorLocal() sem localId, buscando TODOS os registros | 1 query desnecessariamente ampla |

---

### Plano de Otimizacao

#### 1. Mover Providers para rotas especificas (App.tsx)

Atualmente os 3 providers (ClientesProvider, EstoqueProvider, PedidosProvider) envolvem TODAS as rotas. Vamos criar componentes wrapper que agrupam cada provider apenas nas rotas que precisam dele:

- **EstoqueProvider**: `/estoque`, `/feira`, `/transferencias`, `/producao`, `/pedidos/*`
- **PedidosProvider**: `/pedidos/*`
- **ClientesProvider**: `/clientes`, `/pedidos/*`

Rotas como `/dashboard`, `/ajuda`, `/configuracoes/*`, `/alterar-senha` NAO carregarao nenhum desses providers.

#### 2. Converter Dashboard para useQuery (useDashboardData.ts)

Substituir o padrao `useEffect` + `useState` por `useQuery` com:
- `queryKey` baseada em `[periodo, dateRange, excluirCancelados]`
- `staleTime: 60000` (60s) - dados ficam em cache ao navegar entre paginas
- Elimina as 12 queries paralelas repetidas ao revisitar o Dashboard

#### 3. Remover useEstoqueMovimentacoes do contexto global (EstoqueContext.tsx)

As movimentacoes so sao usadas em modais de historico. Remover o carregamento global e expor apenas uma referencia vazia. Os modais que precisam ja usam suas proprias queries locais.

#### 4. Aumentar staleTime dos hooks de contexto

- `useClientes`: de 60s para **5 minutos** (dados de cliente mudam raramente)
- `usePedidos` (global): de 30s para **2 minutos**
- `useEstoqueItens`: de 15s para **30 segundos** (realtime ja cuida de updates criticos)

#### 5. Filtrar useDisponivelCentral por local Central

Passar o localId do Central para `useEstoquePorLocal()` ao inves de buscar TODOS os registros de todos os locais.

---

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/App.tsx` | Criar wrappers e mover providers para rotas especificas |
| `src/hooks/useDashboardData.ts` | Converter de useEffect/useState para useQuery com cache |
| `src/contexts/EstoqueContext.tsx` | Remover useEstoqueMovimentacoes do carregamento global |
| `src/hooks/useEstoqueData.ts` | Aumentar staleTime para 30s |
| `src/hooks/useClientesData.ts` | Aumentar staleTime para 5min |
| `src/hooks/usePedidosData.ts` | Aumentar staleTime para 2min |
| `src/hooks/useEstoqueLocais.ts` | Filtrar useDisponivelCentral por localId Central |

### Estimativa de reducao

| Otimizacao | Reducao estimada |
|---|---|
| Providers em rotas especificas | -60% de queries ao navegar fora dessas paginas |
| Dashboard com useQuery | -12 queries por revisita |
| Remover movimentacoes globais | -1 query pesada por page load |
| staleTime mais agressivo | -40% de refetches |
| **Total estimado** | **~70% de reducao no consumo** |

### O que NAO muda

- Nenhuma migration ou RPC
- Nenhum layout ou componente visual
- Realtime continua funcionando nas paginas de estoque
- Todas as funcionalidades existentes mantidas
- Fluxos de criacao/edicao inalterados

