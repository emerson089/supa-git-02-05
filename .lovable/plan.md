

## Corrigir nome do Cortador no evento "Lote Criado"

### Problema

O campo `responsavel` do lote e sobrescrito a cada movimentacao de etapa. Quando o lote vai para Costura/Faccao, o `responsavel` passa a ser "Patricia" (costureira). O evento "Lote Criado" usa `lot.responsavel` diretamente, mostrando o nome errado.

### Solucao

No `HistoricoProducaoModal.tsx`, em vez de usar `lot.responsavel` para o evento "Lote Criado", buscar o nome do cortador a partir do log inicial (o ultimo log da lista, que tem `processo_novo === 'Corte'` e `processo_anterior` nulo).

### Alteracao

**Arquivo: `src/components/production/HistoricoProducaoModal.tsx`**

Na secao "Creation event" (linhas 185-190), substituir `lot.responsavel` por uma busca no log inicial:

```typescript
// Antes
{lot.responsavel && (
  <span>Cortador: {lot.responsavel}</span>
)}

// Depois - buscar do log inicial (ultimo da lista, processo_anterior nulo)
{(() => {
  const logInicial = data?.logs.find(
    l => !l.processo_anterior && l.processo_novo === 'Corte'
  );
  const cortador = logInicial?.responsavel || lot.responsavel;
  return cortador ? (
    <span>Cortador: {cortador}</span>
  ) : null;
})()}
```

Isso garante que:
- Lotes novos (com log inicial) mostram o cortador correto do log
- Lotes antigos (sem log inicial) usam o fallback `lot.responsavel` (pode estar errado, mas nao ha outra fonte)

### Arquivo modificado

| Arquivo | Alteracao |
|---|---|
| `src/components/production/HistoricoProducaoModal.tsx` | Buscar cortador do log inicial em vez de `lot.responsavel` |

