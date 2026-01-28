

## Plano: Liberar Acesso ao Estoque para Vendedor na Aba Transferências

### Diagnóstico

O vendedor não consegue ver os produtos no estoque da aba "Estoque por Local" porque:

1. **Arquitetura Multi-tenant**: O estoque pertence ao admin (`delockjeans@gmail.com`, user_id: `7dc239f2-...`)
2. **user_locations configurado corretamente**: O vendedor (`emerson089@gmail.com`) tem permissão para o local "Banca da Feira" do admin
3. **RLS policies funcionando**: A policy `vendedor can read allowed locations estoque` já permite leitura via `has_location_access()`
4. **Problema no Frontend**: As queries em `useEstoquePorLocalGerenciamento.ts` adicionam `.eq('user_id', user.id)`, bloqueando o acesso mesmo quando a RLS permite

| Query | Linha | Problema |
|-------|-------|----------|
| Estoque por local | 78 | `.eq('user_id', user.id)` |
| Preços por local | 88 | `.eq('user_id', user.id)` |
| Histórico movimentações | 354 | `.eq('user_id', user.id)` |
| Produtos disponíveis | 395, 407, 425 | `.eq('user_id', user.id)` |

---

### Solução

Remover os filtros `user_id` das queries de leitura, confiando nas RLS policies para controlar o acesso. As RLS já estão configuradas para:
- Vendedor: ver apenas locais permitidos via `has_location_access()`
- Admin/Gerente: ver todos os dados (owner ou role-based)

---

### Alterações Técnicas

#### Arquivo: `src/hooks/useEstoquePorLocalGerenciamento.ts`

**1. `useEstoqueDetalhadoPorLocal` (linhas 77-88)**

Remover `.eq('user_id', user.id)` da query de estoque e preços:

```typescript
// ANTES
.eq('local_id', localId)
.eq('user_id', user.id)  // ❌ Bloqueia vendedor
.gt('quantidade', 0);

// DEPOIS
.eq('local_id', localId)
.gt('quantidade', 0);  // ✅ RLS controla acesso
```

**2. Query de preços (linhas 84-88)**

```typescript
// ANTES
.eq('local_id', localId)
.eq('user_id', user.id);  // ❌ Bloqueia vendedor

// DEPOIS  
.eq('local_id', localId);  // ✅ RLS controla acesso
```

**3. `useHistoricoMovimentacoesItem` (linha 354)**

```typescript
// ANTES
.eq('user_id', user.id)

// DEPOIS
// Remover filtro - RLS já controla via local_id
```

**4. `useProdutosDisponiveis` (linhas 384-425)**

Este hook busca produtos disponíveis no Central para adicionar ao local. Precisa adaptar para buscar o Central **do dono do local**, não do vendedor:

```typescript
// 1. Primeiro buscar o dono do local destino
const { data: localInfo } = await supabase
  .from('estoque_locais')
  .select('id, user_id')
  .eq('id', localId)
  .single();

const ownerUserId = localInfo?.user_id;

// 2. Buscar Central do mesmo dono
const { data: localCentral } = await supabase
  .from('estoque_locais')
  .select('id')
  .eq('user_id', ownerUserId)
  .eq('tipo', 'central')
  .maybeSingle();
```

---

### Diagrama de Fluxo

```
Vendedor acessa /transferencias
        │
        ▼
useUserLocations() → Retorna locais permitidos
        │
        ▼
useEstoqueDetalhadoPorLocal(lojaId)
        │
        ▼
Supabase Query (SEM user_id filter)
        │
        ▼
RLS Policy: "vendedor can read allowed locations estoque"
        │
        ▼
has_location_access(vendedor_id, local_id, 'view')
        │
        ▼
Retorna TRUE (configurado em user_locations)
        │
        ▼
Dados do estoque retornados ✅
```

---

### Impacto nos Dados

| Antes | Depois |
|-------|--------|
| Vendedor vê 0 produtos | Vendedor vê produtos do local permitido |
| Query filtra por user_id do vendedor | RLS filtra por local_id permitido |
| Estoque do admin inacessível | Estoque do admin visível se local liberado |

---

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useEstoquePorLocalGerenciamento.ts` | Remover filtros `user_id` das queries de leitura |

---

### Segurança

A solução é segura porque:
1. **RLS já controla o acesso**: Vendedor só vê dados de locais configurados em `user_locations`
2. **has_location_access()**: Função SQL SECURITY DEFINER valida permissões
3. **Sem exposição de dados**: Vendedor não pode ver outros locais ou dados de outros donos
4. **Mutations protegidas**: Operações de escrita mantêm validação

---

### Resultado Esperado

Após as alterações, o vendedor verá:
- Lista de produtos com estoque no local permitido
- Totais de peças e modelos
- Valor do estoque (venda)
- Capacidade de ajustar estoque (se `can_adjust_stock = true`)
- Capacidade de editar preços (se `can_edit_price = true`)

