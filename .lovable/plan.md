

## Corrigir erro "Could not choose the best candidate function" no ajuste de estoque

### Problema
Existem **duas versoes** da funcao `rpc_ajustar_estoque_local` no banco de dados:
- Versao antiga: 5 parametros (p_local_id, p_item_id, p_nova_quantidade, p_user_id, p_motivo)
- Versao nova: 7 parametros (os mesmos + p_tipo_ajuste_id, p_preco_aplicado)

Quando o codigo envia parametros opcionais condicionalmente, o PostgreSQL nao consegue decidir qual funcao chamar, gerando o erro. O mesmo problema existe com `rpc_criar_transferencia` (duas versoes tambem).

### Solucao

#### 1. Remover funcoes duplicadas (migracao SQL)
- Dropar a versao antiga de `rpc_ajustar_estoque_local` (5 parametros)
- Dropar a versao antiga de `rpc_criar_transferencia` (5 parametros, sem p_observacoes)

#### 2. Corrigir o codigo cliente
**Arquivo:** `src/hooks/useEstoquePorLocalGerenciamento.ts`
- Sempre enviar **todos os 7 parametros** na chamada RPC, usando `null` para os opcionais quando nao preenchidos, em vez de omiti-los condicionalmente

### Detalhes tecnicos

**Migracao SQL:**
```sql
DROP FUNCTION IF EXISTS public.rpc_ajustar_estoque_local(uuid, uuid, numeric, uuid, text);
DROP FUNCTION IF EXISTS public.rpc_criar_transferencia(uuid, uuid, jsonb, uuid, text);
```

**Alteracao no hook (useEstoquePorLocalGerenciamento.ts):**
Em vez de adicionar `p_tipo_ajuste_id` e `p_preco_aplicado` condicionalmente ao objeto de parametros, sempre inclui-los com valor `null` quando nao fornecidos. Isso garante que o PostgreSQL sempre resolva para a funcao de 7 parametros sem ambiguidade.
