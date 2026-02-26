

## Corrigir filtros do Relatorio de Saidas que nao mostram movimentacoes

### Problema identificado

O relatorio filtra movimentacoes por `user_id = usuario_logado`. Porem, quando um vendedor faz um ajuste de estoque em um local do admin, a movimentacao e gravada com `user_id = vendedor` (quem fez o ajuste). Resultado: o admin nunca ve as movimentacoes feitas por vendedores, mesmo sendo dono dos locais.

Dados confirmados no banco:
- Vendas feitas pelo vendedor na "Loja Parque das Feiras" (local do admin) tem `user_id = vendedor`
- Quando o admin filtra por "Venda / loja", a query exige `user_id = admin` e nao encontra nada

### Solucao

Trocar o filtro de `user_id` por filtro baseado em **locais do admin** na query de movimentacoes.

### Alteracoes

**Arquivo:** `src/hooks/useRelatorioSaidas.ts`

1. **Buscar todos os locais do admin**: Quando `localId` nao esta definido ("todos"), buscar todos os IDs de locais pertencentes ao usuario logado e filtrar movimentacoes por `.in('local_id', meusLocaisIds)`.

2. **Quando local especifico**: Filtrar por `.eq('local_id', localId)` e **remover** o filtro `.eq('user_id', user.id)`.

3. **Resolver owner para tipos de ajuste**: Quando `localId` estiver definido, buscar o `user_id` do local para consultar `tipos_ajuste_estoque` com o owner correto (mesmo padrao ja usado em `useTiposAjusteParaFiltro`).

### Detalhes tecnicos

Na funcao `useRelatorioSaidas`, substituir a linha `.eq('user_id', user.id)` na query de `estoque_movimentacoes` por:

```typescript
// Se local especifico, filtrar por local_id
if (filtros.localId) {
  query = query.eq('local_id', filtros.localId);
} else {
  // "Todos" - buscar locais do admin e filtrar por eles
  const { data: meusLocais } = await supabase
    .from('estoque_locais')
    .select('id')
    .eq('user_id', user.id);
  const meusLocaisIds = meusLocais?.map(l => l.id) || [];
  if (meusLocaisIds.length > 0) {
    query = query.in('local_id', meusLocaisIds);
  }
}
```

E para a query de `tipos_ajuste_estoque`, resolver o owner do local:

```typescript
let ownerId = user.id;
if (filtros.localId) {
  const { data: localData } = await supabase
    .from('estoque_locais')
    .select('user_id')
    .eq('id', filtros.localId)
    .maybeSingle();
  if (localData?.user_id) ownerId = localData.user_id;
}
```

Isso garante que:
- Admin ve todas as movimentacoes dos seus locais (incluindo as feitas por vendedores)
- Vendedor ve movimentacoes do local que tem acesso
- Filtros de tipo funcionam corretamente para ambos os perfis

