
## Plano: Corrigir Exclusão de Modelos Bloqueada por Status "Estornada"

### Problema Identificado
O erro "violates foreign key constraint transferencia_itens_item_id_fkey" ocorre porque a lógica de limpeza antes da exclusão não considera transferências com status `estornada`.

### Análise Técnica

**Arquivo**: `src/hooks/useEstoqueData.ts`

**Lógica Atual (linha 398-400)**:
```typescript
const itensParaDeletar = itensParaLimpar?.filter((i: any) => 
  i.transferencias?.deleted_at !== null || i.transferencias?.status === 'concluida'
) || [];
```

**Problema**: Transferências com status `estornada` ou `cancelada` não são incluídas na limpeza, deixando registros órfãos em `transferencia_itens` que bloqueiam a exclusão do item.

### Status de Transferências no Sistema

| Status | Pode excluir item? | Motivo |
|--------|-------------------|--------|
| `em_andamento` | Não | Carga ativa, precisa finalizar/estornar primeiro |
| `concluida` | Sim | Histórico pode ser limpo |
| `estornada` | Sim | Carga já foi revertida, histórico pode ser limpo |
| `cancelada` | Sim | Carga cancelada, histórico pode ser limpo |
| `deleted_at != null` | Sim | Soft-deleted, histórico pode ser limpo |

### Solução

Expandir o filtro para incluir todos os status que permitem limpeza do histórico:

**Código Corrigido**:
```typescript
// Filtrar itens que podem ser deletados 
// (concluídas, estornadas, canceladas ou soft-deleted)
const itensParaDeletar = itensParaLimpar?.filter((i: any) => 
  i.transferencias?.deleted_at !== null || 
  i.transferencias?.status === 'concluida' ||
  i.transferencias?.status === 'estornada' ||
  i.transferencias?.status === 'cancelada'
) || [];
```

### Alteração Necessária

**Arquivo**: `src/hooks/useEstoqueData.ts`
- **Linhas**: 397-400
- **Mudança**: Adicionar `estornada` e `cancelada` à condição de filtro

### Resultado Esperado

- Modelos com transferências estornadas/canceladas poderão ser excluídos normalmente
- A limpeza do histórico acontecerá automaticamente antes da exclusão
- Modelos com cargas `em_andamento` continuarão bloqueados (comportamento correto)

### Arquivos Impactados

1. `src/hooks/useEstoqueData.ts` - Linha 398-400
