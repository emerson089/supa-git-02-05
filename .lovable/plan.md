

## Plano: Correções no Modal de Detalhes e Referência nos Itens de Grade

### Problema 1 — Valores desatualizados no modal "Detalhes do Pedido"

**Causa raiz**: Quando o usuário clica em "Ver Detalhes", o pedido é copiado para o state `selectedPedido` como snapshot. Após editar o pedido (via EditPedidoModal), a lista atualiza via React Query, mas o `selectedPedido` continua com os valores antigos. Os campos Total de Peças, Qtd de Modelos, Desconto e Valor Total ficam defasados.

**Correção em `src/pages/PedidosCriados.tsx`**:
- Quando o modal de detalhes está aberto (`selectedPedido` != null), sincronizar automaticamente o `selectedPedido` com os dados mais recentes da lista paginada (`pedidosList`)
- Adicionar um `useEffect` que, sempre que `pedidosList` mudar, atualiza o `selectedPedido` com o pedido correspondente da lista atualizada (pelo `id`)

```typescript
// Novo useEffect para manter selectedPedido sincronizado
useEffect(() => {
  if (selectedPedido && pedidosList.length > 0) {
    const updated = pedidosList.find(p => p.id === selectedPedido.id);
    if (updated && updated !== selectedPedido) {
      setSelectedPedido(updated);
    }
  }
}, [pedidosList]);
```

### Problema 2 — Referência não aparece nos cards de grade (NovoPedido)

**Causa raiz**: No `AddGradeModal`, o campo `modeloNome` é preenchido com `modeloSelecionado.nome.split('—')[0].trim()`, que retorna apenas o nome sem a referência. O `GradeCompactCard` exibe esse `modeloNome` sem referência.

**Correção em `src/components/pedidos/AddGradeModal.tsx`** (linha 144):
- Incluir a referência no `modeloNome`: concatenar o nome do modelo com a referência

```typescript
// De:
modeloNome: modeloSelecionado.nome.split('—')[0].trim(),
// Para:
modeloNome: `${modeloSelecionado.nome.split('—')[0].trim()} ${modeloSelecionado.meta.referencia}`,
```

### Resumo
- 2 arquivos alterados, ~10 linhas no total
- Problema 1: sincronização do state local com dados atualizados do React Query
- Problema 2: adicionar referência ao nome exibido nos cards de grade

