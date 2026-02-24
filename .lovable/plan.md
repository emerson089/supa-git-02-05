

## Correcao: Vendedor nao consegue ajustar estoque

### Problema

A funcao RPC `rpc_ajustar_estoque_local` busca o registro de estoque filtrando por `user_id = v_auth_uid` (o ID do vendedor logado). Porem, os registros em `estoque_por_local` pertencem ao admin (o `user_id` e do admin, nao do vendedor). Por isso a busca retorna NULL e a funcao lanca: **"Estoque nao encontrado para este item/local"**.

O mesmo problema afeta a busca do local Central (linha 222), que tambem filtra por `user_id = v_auth_uid`.

### Solucao

Alterar a RPC para buscar o `user_id` (owner) a partir da tabela `estoque_locais` usando o `p_local_id`, em vez de assumir que o usuario logado e o dono do estoque. A validacao de permissao do vendedor ja esta correta (via `has_location_access`).

### Arquivo modificado

| Arquivo | Alteracao |
|---|---|
| Nova migration SQL | Recriar `rpc_ajustar_estoque_local` corrigindo as queries para usar o owner do local em vez do auth_uid |

### Mudancas na RPC

```sql
-- ANTES (linha 222): busca Central pelo usuario logado
SELECT id INTO v_central_local_id
FROM estoque_locais
WHERE user_id = v_auth_uid AND tipo = 'central';

-- ANTES (linha 227): busca estoque pelo usuario logado
SELECT * INTO v_estoque_atual
FROM estoque_por_local
WHERE item_id = p_item_id AND local_id = p_local_id AND user_id = v_auth_uid;
```

```sql
-- DEPOIS: buscar o owner do local primeiro
SELECT user_id INTO v_owner_id
FROM estoque_locais
WHERE id = p_local_id;

-- Buscar Central pelo DONO do local
SELECT id INTO v_central_local_id
FROM estoque_locais
WHERE user_id = v_owner_id AND tipo = 'central';

-- Buscar estoque usando item_id + local_id (sem filtro user_id, ja que local_id e unico)
SELECT * INTO v_estoque_atual
FROM estoque_por_local
WHERE item_id = p_item_id AND local_id = p_local_id;
```

A movimentacao continua registrada com `v_auth_uid` (o vendedor que fez o ajuste), preservando a auditoria.

### O que NAO muda

- Validacao de autenticacao (auth.uid)
- Validacao de permissao do vendedor (has_location_access)
- Registro de movimentacao (continua com o ID do vendedor)
- Sincronizacao com estoque_itens (trigger automatico)
- Nenhum arquivo frontend alterado
- Nenhuma query ou calculo impactado

