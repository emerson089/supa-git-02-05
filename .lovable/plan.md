

## Plano: Corrigir retorno de carga que trava/falha

### Problema identificado

A função `sincronizarEstoqueTotal` (chamada após cada item no retorno) busca o local Central filtrando por `user_id`:

```typescript
.eq('user_id', userId) // ← se o usuário é vendedor, não encontra o local do admin
.eq('tipo', 'central')
```

Quando um vendedor registra o retorno, o `userId` dele não corresponde aos registros de `estoque_locais` (que pertencem ao admin). Isso causa o erro "Local Central não encontrado", travando o processo com o spinner infinito.

O hook `useRegistrarRetornoFeira` já busca os locais corretamente (sem filtro de `user_id`), mas depois chama `sincronizarEstoqueTotal` que re-introduz o filtro problemático.

### Alterações

**1. `src/hooks/useTransferencias.ts` — `sincronizarEstoqueTotal`**
- Remover o filtro `.eq('user_id', userId)` da query de `estoque_locais`, usando apenas `.eq('tipo', 'central')` — assim funciona tanto para admin quanto para vendedores
- Alternativa: buscar o local central via query sem filtro de `user_id` (mesma abordagem usada no `useRegistrarRetornoFeira`)

**2. `src/hooks/useTransferencias.ts` — `useRegistrarRetornoFeira`**
- Otimizar: passar o `central.id` já encontrado para evitar re-consulta redundante em cada item
- Adicionar `onError` handler na mutation para log mais claro

**3. `src/pages/Feira.tsx`**
- Adicionar tratamento de erro mais visível caso a mutation falhe silenciosamente

### Impacto
- Corrige o bug para vendedores que tentam registrar retorno
- Reduz chamadas redundantes ao banco (uma query de local central por item → zero)
- Mantém compatibilidade com admin que já funciona

