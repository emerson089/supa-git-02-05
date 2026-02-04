

## Plano: Atualização Automática em Tempo Real (Produção)

### Situação Atual

1. **Sem realtime na produção**: As tabelas `producao` e `producao_log` não têm canal de realtime configurado
2. **Dados estáticos**: Para ver mudanças, é necessário recarregar a página manualmente
3. **Modal de histórico**: Também não atualiza automaticamente se outro usuário mover o lote

### Estratégia de Economia de Créditos

Vou aplicar a mesma estratégia já utilizada no módulo de Estoque (`useRealtimeEstoque`):

| Técnica | Descrição |
|---------|-----------|
| **Invalidação Granular** | Em vez de refetch de tudo, invalida apenas queries ativas/montadas |
| **refetchType: 'active'** | Só recarrega dados de componentes visíveis na tela |
| **Filtro por evento** | UPDATE invalida menos que INSERT/DELETE |
| **Canal único** | Um único canal para ambas as tabelas (producao + producao_log) |

### Alterações Técnicas

#### 1. Novo Hook: `src/hooks/useRealtimeProducao.ts`

Criar um hook global (similar ao `useRealtimeEstoque`) que:
- Escuta mudanças em `producao` (movimentos de lotes entre etapas)
- Escuta mudanças em `producao_log` (novos registros de histórico)
- Invalida queries de forma inteligente baseado no tipo de evento:

```typescript
// Para eventos UPDATE (mais comum - mover lote)
if (payload.eventType === 'UPDATE') {
  queryClient.invalidateQueries({ 
    queryKey: ['producao-etapa'],
    refetchType: 'active' // Só colunas visíveis!
  });
  queryClient.invalidateQueries({ 
    queryKey: ['producao-contagens'],
    refetchType: 'active'
  });
}

// Para INSERT em producao_log (histórico)
if (payload.table === 'producao_log' && payload.eventType === 'INSERT') {
  const producaoId = payload.new?.producao_id;
  if (producaoId) {
    // Invalida apenas o log daquele lote específico
    queryClient.invalidateQueries({ 
      queryKey: ['producao-logs-tempo', producaoId],
      refetchType: 'active'
    });
  }
}
```

#### 2. Habilitar Realtime nas Tabelas (Migração SQL)

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.producao;
ALTER PUBLICATION supabase_realtime ADD TABLE public.producao_log;
```

#### 3. Montar Hook no App

Em `src/pages/Index.tsx` (ou no componente de produção), chamar o hook para iniciar a escuta:

```typescript
// No início do componente Index
useRealtimeProducao(); // Inicia escuta realtime
```

### Comportamento Esperado

| Cenário | O que acontece |
|---------|----------------|
| **Usuário A move lote** | Usuário B vê lote mudar de coluna automaticamente |
| **Novo lote criado** | Aparece na coluna correta sem reload |
| **Modal histórico aberto** | Atualiza timeline se houver nova movimentação |
| **Tela em segundo plano** | Não consome créditos (refetchType: 'active') |

### Arquivos a Criar/Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useRealtimeProducao.ts` | **Novo** - Hook de realtime para produção |
| `src/pages/Index.tsx` | Montar o hook `useRealtimeProducao()` |
| Migração SQL | Habilitar realtime nas tabelas |

### Estimativa de Economia

Comparado a polling a cada 5 segundos:
- **Polling**: ~720 queries/hora por usuário
- **Realtime com invalidação granular**: ~10-50 queries/hora (apenas quando há mudanças reais)
- **Economia**: ~95%+ menos queries

### Layout do Fluxo

```
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Realtime                            │
│                                                                 │
│   producao         producao_log                                 │
│      │                  │                                       │
│      └────────┬─────────┘                                       │
│               │                                                 │
│               ▼                                                 │
│   ┌─────────────────────────┐                                   │
│   │ useRealtimeProducao()   │                                   │
│   │ (Canal único)           │                                   │
│   └───────────┬─────────────┘                                   │
│               │                                                 │
│               ▼                                                 │
│   ┌─────────────────────────┐                                   │
│   │ QueryClient.invalidate  │                                   │
│   │ (refetchType: 'active') │                                   │
│   └───────────┬─────────────┘                                   │
│               │                                                 │
│     ┌─────────┼─────────┬──────────────┐                        │
│     ▼         ▼         ▼              ▼                        │
│ [Contagens] [Colunas] [Cards]   [Modal Histórico]               │
│  visíveis   visíveis                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Resultado Esperado

1. Lotes movem entre colunas automaticamente em tempo real
2. Modal de histórico atualiza se aberto durante uma movimentação
3. Contagens nas colunas atualizam sem reload
4. Economia máxima de créditos (só refetch do que está visível)
5. Nenhum polling - conexão WebSocket eficiente

