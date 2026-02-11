

## Correções: Exclusão sem Reversão de Estoque + Coluna Modelo Legível

### Problema 1: Exclusão revertendo estoque indevidamente

Ao excluir movimentações no Relatório de Saídas, o hook `useExcluirMovimentacoes` calcula deltas e atualiza `estoque_por_local`, devolvendo quantidade ao estoque. O usuário quer que a exclusão seja apenas uma remoção do registro, sem nenhuma alteração no estoque.

### Problema 2: Nome do modelo cortado na tabela

A coluna "Modelo" usa `truncateText(saida.modeloNome, 30)` que corta nomes longos com "..." tornando impossível ler o nome completo.

### Correções

| Arquivo | Alteração |
|---|---|
| `src/hooks/useExcluirMovimentacoes.ts` | Remover toda a lógica de reversão de estoque (linhas 27-66). Manter apenas a exclusão dos registros em `estoque_movimentacoes`. Remover invalidação de queries de estoque desnecessárias. |
| `src/components/estoque/RelatorioSaidasModal.tsx` | Remover `truncateText` da coluna Modelo (linha 691) -- exibir o nome completo. Adicionar `whitespace-nowrap` ou `min-w` para garantir legibilidade. Atualizar o texto do AlertDialog removendo a mensagem sobre reversão de estoque. |

### Detalhes Técnicos

**useExcluirMovimentacoes.ts** -- simplificar para:
```typescript
mutationFn: async (movimentacoes) => {
  if (!user) throw new Error('Usuário não autenticado');
  if (movimentacoes.length === 0) throw new Error('Nenhuma movimentação selecionada');

  const ids = movimentacoes.map(m => m.id);
  const { error } = await supabase
    .from('estoque_movimentacoes')
    .delete()
    .in('id', ids);

  if (error) throw error;
  return ids.length;
}
```

Remover invalidação de `estoque-por-local` e `estoque-itens` no `onSuccess`, mantendo apenas `relatorio-saidas` e `vendas-desde-contagem`.

**RelatorioSaidasModal.tsx** -- coluna Modelo:
- Remover `truncateText(saida.modeloNome, 30)` e exibir `saida.modeloNome` diretamente
- Adicionar `min-w-[200px]` no `TableHead` do Modelo para dar mais espaço
- Remover truncate também do Local (linha 711) e Motivo (linha 708) para melhor legibilidade

**AlertDialog** -- atualizar texto:
- Remover a frase "O estoque será revertido automaticamente."
- Manter apenas "Esta ação não pode ser desfeita."

