

## Padronizar nome "Venda Feira" para "Venda / Loja"

O label "Venda Feira" no filtro de Tipo de Saida do Relatorio de Saidas e no Historico de Movimentacoes sera renomeado para "Venda / Loja", para ficar consistente com o nome usado no modal de Ajuste de Estoque.

### Alteracoes

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useRelatorioSaidas.ts` | Linha 49: trocar `'Venda Feira'` por `'Venda / Loja'` |
| `src/components/estoque/HistoricoMovimentacoesModal.tsx` | Linha 53: trocar `'Venda Feira'` por `'Venda / Loja'` |

Sao apenas 2 labels de exibicao. Os valores internos (`VENDA_FEIRA`) nao mudam -- apenas o texto visivel ao usuario.

