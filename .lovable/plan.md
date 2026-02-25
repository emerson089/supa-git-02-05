

## Mostrar Apenas Tipos de Ajuste no Filtro do Relatorio de Saidas

### Problema

O filtro "Tipo de Movimentacao" mostra 4 tipos de sistema fixos (Venda/Loja, Envio Feira, Transferencia, Retorno Feira) que nao refletem a configuracao do usuario. O usuario quer que esse filtro mostre apenas os tipos configurados na tela de "Tipos de Ajuste".

### Solucao

Remover os tipos de sistema (TIPOS_SISTEMA) do filtro visual e mostrar apenas os tipos de ajuste do usuario. No backend, quando nenhum filtro e selecionado, o relatorio continua buscando todos os tipos de saida normalmente.

Tambem precisa incluir os tipos marcados como `contaComoVenda` na lista (antes eram filtrados), ja que agora sao a unica fonte de opcoes.

### Alteracoes

**Arquivo: `src/components/estoque/RelatorioSaidasModal.tsx`**

1. Remover a constante `TIPOS_SISTEMA` (linhas 64-70)
2. Simplificar `opcoesUnificadas` para listar apenas tipos de ajuste do usuario (todos, incluindo `contaComoVenda`), deduplicados por nome
3. No JSX do popover (linhas 355-414), remover a secao "Tipos de sistema" e o separador, mostrando apenas a lista de tipos de ajuste como opcoes diretas
4. Manter o `kind: 'ajuste'` para todos os filtros, ja que nao havera mais `kind: 'sistema'`

**Arquivo: `src/hooks/useRelatorioSaidas.ts`**

5. Ajustar a logica de resolucao de filtros: quando filtros com `kind: 'ajuste'` sao selecionados, mapear os que tem `contaComoVenda` para incluir `VENDA_FEIRA` nos tipos de query (mantendo o comportamento atual de "Venda/Loja")
6. Quando nenhum filtro e selecionado, continuar buscando todos os tipos (sem mudanca)

### Impacto

- O filtro refletira exatamente o que esta configurado em "Tipos de Ajuste"
- Tipos como "Venda / loja" (marcados como contaComoVenda) aparecerao na lista
- Tipos como "Ajuste de estoque", "Defeito", "Devolucao" aparecerao normalmente
- Sem filtro selecionado, o relatorio continua mostrando tudo
- A query de dados nao e afetada quando nenhum filtro esta ativo

