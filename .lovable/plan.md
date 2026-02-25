

## Corrigir: Produtos nao aparecem ao transferir da Loja para Central

### Causa raiz

O hook `useDisponivelCentral` (em `useEstoqueLocais.ts`, linha 364) chama `useEstoquePorLocal(centralId)`, filtrando apenas o estoque do Central. O componente `Transferencias.tsx` usa o array `estoquePorLocal` retornado por esse hook na funcao `getDisponivelNoLocal(itemId, localId)` para verificar disponibilidade em qualquer local.

Quando o usuario seleciona "Loja Parque das Feiras" como origem, a funcao busca itens com `localId === lojaId` dentro de um array que so contem itens do Central -- resultado: zero produtos disponiveis.

### Solucao

Alterar `useDisponivelCentral` para buscar estoque de **todos os locais** (sem filtro de localId), em vez de filtrar apenas pelo Central. Isso permite que `getDisponivelNoLocal` funcione corretamente para qualquer local selecionado como origem ou destino.

### Alteracao tecnica

No arquivo `src/hooks/useEstoqueLocais.ts`, linha 364:

**Antes:**
```typescript
const { data: estoquePorLocal } = useEstoquePorLocal(centralId);
```

**Depois:**
```typescript
const { data: estoquePorLocal } = useEstoquePorLocal();
```

Remover tambem a variavel `centralId` que so era usada para esse filtro (ela continua sendo usada em `getDisponivelCentral`, entao manter o calculo mas usar o array completo para busca).

Na verdade, `centralId` ainda e usado em `getDisponivelCentral` (linha 369), entao so precisa mudar a chamada de `useEstoquePorLocal` para nao passar o filtro.

### Arquivo modificado

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useEstoqueLocais.ts` | Remover filtro `centralId` da chamada `useEstoquePorLocal` para carregar estoque de todos os locais |

### Impacto

- A funcao `getDisponivelNoLocal` passara a encontrar estoque em qualquer local (Central, Loja, Banca)
- Transferencias de Loja para Central funcionarao corretamente
- Os badges "Origem" e "Destino" mostrarao valores corretos para qualquer combinacao de locais
- Performance: a query buscara todos os registros de `estoque_por_local` em vez de filtrar por um local, mas o volume de dados e pequeno

