

## Mudanca no Modal de Ajuste: "Qtd Vendida" em vez de "Novo Estoque"

### O que muda

O campo do meio do modal passa de **"Novo Estoque"** (onde a vendedora digitava o saldo final) para **"Qtd Vendida"** (onde ela digita quantas pecas foram vendidas). O sistema calcula automaticamente o novo estoque.

### Fluxo atual vs novo

```text
ATUAL:
Estoque Atual: 17  |  Novo Estoque: [17]  |  Diferenca: 0
Vendedora precisa calcular: 17 - 6 = 11, digitar 11

NOVO:
Estoque Atual: 17  |  Qtd Vendida: [0]  |  Novo Estoque: 11
Vendedora digita apenas: 6 (o que vendeu)
Sistema calcula: 17 - 6 = 11
```

### Arquivo modificado

| Arquivo | Alteracao |
|---|---|
| `src/components/estoque/AjusteEstoqueModal.tsx` | Trocar campo "Novo Estoque" por "Qtd Vendida". Calcular novo estoque automaticamente. Mostrar resultado na terceira coluna. |

### Detalhes tecnicos

**Estados:**
- `estoqueAtualEditavel` -- mantido igual (estoque atual, editavel para correcao)
- `novaQuantidade` -- renomeado para `qtdVendida`, inicia em `'0'` em vez do valor atual
- O `novaQtd` enviado para a RPC sera calculado como `estoqueAtualInt - qtdVendidaInt`

**Layout das 3 colunas:**

| Coluna 1 | Coluna 2 | Coluna 3 |
|---|---|---|
| Estoque Atual (editavel) | Qtd Vendida (input, foco automatico) | Novo Estoque (calculado, apenas exibicao) |
| 17 | [6] | 11 |

- O foco automatico (inputRef) passa para o campo "Qtd Vendida" (coluna 2)
- A terceira coluna mostra o resultado calculado com cores: verde se entrada, vermelho se saida
- Validacao: novo estoque nao pode ser negativo (qtd vendida > estoque atual)

**Calculo:**
```typescript
const qtdVendidaInt = parseInt(qtdVendida) || 0;
const novoEstoqueCalculado = estoqueAtualInt - qtdVendidaInt;
// novoEstoqueCalculado e o valor enviado para a RPC como novaQuantidade
```

### O que NAO muda

- Nenhuma RPC ou query alterada
- O valor enviado ao backend continua sendo `novaQuantidade` (o saldo final calculado)
- Tipos de ajuste, observacao, validacoes de permissao -- tudo inalterado
- Layout mobile (Drawer) e desktop (Dialog) mantidos
- Estoque Atual continua editavel (para correcao de contagem)

