

## Correcoes: Campo "Qtd Vendida" e Tipos de Ajuste no Relatorio

### Problema 1: Campo "Qtd Vendida" com zero persistente

Quando a vendedora clica no campo "Qtd Vendida", o valor `0` permanece. Ao digitar `6`, o resultado e `06` em vez de `6`. O campo precisa limpar o zero ao receber foco.

### Problema 2: Tipos de Saida e Tipos de Ajuste desconectados no Relatorio

No "Relatorio de Saidas do Estoque", existem dois filtros separados:
- **Tipo de Saida**: opcoes fixas no codigo (Ajuste Estoque, Venda/Loja, Envio Feira, Transferencia, Retorno Feira)
- **Tipo de Ajuste**: tipos cadastrados pelo admin (Ajuste de estoque, Devolucao de cliente, Perda/Avaria, Venda/loja, etc.)

Esses filtros deveriam estar conectados - os tipos de ajuste cadastrados pelo admin sao os mesmos que devem aparecer como opcoes de filtragem. Alem disso, o hook `useTiposAjusteParaFiltro` busca por `user.id` sem resolver o owner, causando o mesmo problema que ja corrigimos nos outros hooks (vendedor nao ve os tipos do admin).

### Solucao

---

### Correcao 1: Campo "Qtd Vendida"

**Arquivo:** `src/components/estoque/AjusteEstoqueModal.tsx`

- No `handleQtdVendidaChange`: quando o valor limpo comeca com zeros a esquerda, remover (ex: `06` vira `6`)
- No `onFocus` do campo "Qtd Vendida": se o valor for `'0'`, limpar para string vazia para a vendedora poder digitar diretamente
- No `onBlur`: se o campo ficou vazio, restaurar para `'0'`
- Mesma logica aplicada ao campo "Estoque Atual" para consistencia

### Correcao 2: Hook `useTiposAjusteParaFiltro` com resolucao de owner

**Arquivo:** `src/hooks/useTiposAjuste.ts`

- Adicionar parametro opcional `localId` ao hook `useTiposAjusteParaFiltro` (mesmo padrao ja aplicado ao `useTiposAjuste`)
- Resolver o `user_id` (owner) a partir do local antes de buscar os tipos
- Isso garante que vendedores veem os tipos do admin no relatorio

### Correcao 3: Conectar Tipos de Saida com Tipos de Ajuste no Relatorio

**Arquivo:** `src/components/estoque/RelatorioSaidasModal.tsx`

- Passar o `localId` selecionado para `useTiposAjusteParaFiltro(localId)`
- Manter os dois niveis de filtro (Tipo de Saida para categorias gerais como Transferencia/Envio Feira, e Tipo de Ajuste para os ajustes cadastrados), pois sao conceitualmente diferentes
- O filtro "Tipo de Ajuste" ja aparece condicionalmente quando "Ajuste" esta selecionado - isso esta correto

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/components/estoque/AjusteEstoqueModal.tsx` | Limpar zero ao focar no campo Qtd Vendida; restaurar zero ao sair se vazio |
| `src/hooks/useTiposAjuste.ts` | Adicionar `localId` ao `useTiposAjusteParaFiltro` com resolucao de owner |
| `src/components/estoque/RelatorioSaidasModal.tsx` | Passar `localId` para `useTiposAjusteParaFiltro` |

### O que NAO muda

- Nenhuma RPC ou migration necessaria (a RLS para vendedor ja foi adicionada)
- Tipos de saida fixos (Transferencia, Envio Feira, etc.) continuam como estao - sao categorias de movimentacao do sistema
- Calculo de estoque e validacoes inalterados
- Layout geral dos modais mantido
