

## Correcao: Vendedora nao consegue ver/criar tipos de ajuste

### Problema

A tabela `tipos_ajuste_estoque` pertence ao admin (os registros tem `user_id` do admin). Quando a vendedora abre o modal de ajuste:

1. O hook `useTiposAjuste` busca tipos com `user_id = vendedora` -- nao encontra nada
2. O hook `useCriarTiposPadrao` tenta criar tipos com `user_id = vendedora` -- RLS bloqueia o INSERT porque a vendedora nao e dona dos tipos originais, e mesmo que passasse, criaria duplicatas separadas dos tipos do admin

O mesmo padrao pode afetar `useContagensEstoque` e `useRelatorioSaidas` que tambem filtram `tipos_ajuste_estoque` por `user.id`.

### Solucao

Duas mudancas:

1. **RLS**: Adicionar politica SELECT para vendedores lerem os tipos do admin (via `has_role`)
2. **Frontend**: O hook `useTiposAjuste` precisa resolver o owner_id a partir do local (como ja fazemos para estoque), em vez de usar `user.id` diretamente. O modal ja tem o `localId` disponivel.

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| Nova migration SQL | Adicionar politica SELECT em `tipos_ajuste_estoque` para vendedores |
| `src/hooks/useTiposAjuste.ts` | Adicionar parametro opcional `localId` ao `useTiposAjuste`. Quando presente, resolver o owner_id do local e buscar tipos desse owner. Remover auto-criacao de tipos padrao para vendedores. |
| `src/components/estoque/AjusteEstoqueModal.tsx` | Passar `localId` para `useTiposAjuste`. Remover logica de criacao automatica de tipos padrao (vendedora usa os do admin). |

### 1) Migration SQL

```sql
-- Permitir que vendedores leiam tipos de ajuste (do admin/dono)
CREATE POLICY "vendedor can read tipos_ajuste"
ON public.tipos_ajuste_estoque
FOR SELECT
USING (
  has_role(auth.uid(), 'vendedor'::app_role)
);
```

Isso permite que vendedores facam SELECT em qualquer registro da tabela. Como os tipos sao cadastrados apenas pelo admin, isso da acesso aos tipos corretos.

### 2) Mudancas no hook (`useTiposAjuste.ts`)

O hook `useTiposAjuste` ganha um parametro opcional `localId`. Quando fornecido:

```typescript
export function useTiposAjuste(localId?: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['tipos-ajuste', user?.id, localId],
    queryFn: async (): Promise<TipoAjuste[]> => {
      if (!user) return [];

      // Resolver owner: se tem localId, buscar dono do local
      let ownerId = user.id;
      if (localId) {
        const { data: localData } = await supabase
          .from('estoque_locais')
          .select('user_id')
          .eq('id', localId)
          .maybeSingle();
        if (localData?.user_id) {
          ownerId = localData.user_id;
        }
      }

      const { data, error } = await supabase
        .from('tipos_ajuste_estoque')
        .select('id, nome, ativo, conta_como_venda, created_at')
        .eq('user_id', ownerId)  // Usa o owner resolvido
        .eq('ativo', true)
        .order('nome');
      // ...resto igual
    },
    enabled: !!user,
  });
}
```

### 3) Mudancas no Modal (`AjusteEstoqueModal.tsx`)

- Passar `item.localId` para `useTiposAjuste(item?.localId)`
- Remover o `useEffect` que chama `criarTiposPadrao.mutate()` para vendedores (vendedora usa os tipos do admin, nao cria os proprios)
- Manter a criacao automatica apenas quando o owner nao tem tipos (admin abrindo pela primeira vez)

### O que NAO muda

- Nenhuma RPC alterada
- Tabela `tipos_ajuste_estoque` sem mudanca de schema
- Fluxo do admin continua identico
- Tela de gerenciamento de tipos (ConfigTiposAjuste) nao muda
- Nenhum calculo ou KPI impactado
