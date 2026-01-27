
## Plano: Filtrar Pendentes Antes de Paginar

### Problema Atual

O fluxo atual está:
1. Buscando 24 clientes por página (do total de 1.090)
2. Depois filtrando quais desses 24 são "Pendentes"
3. Resultado: apenas alguns clientes aparecem por página, obrigando navegar por 46 páginas

### Solução

Inverter a lógica: **filtrar primeiro, paginar depois**.

Quando o filtro "Pendentes" estiver ativo:
1. Buscar os IDs de clientes pendentes (já existe no `useClientesCRMFilter`)
2. Passar esses IDs para a query paginada como `.in('id', crmFilterIds)`
3. A paginação será sobre o conjunto filtrado (ex: 50 pendentes = 3 páginas)

---

### Alterações Técnicas

**Arquivo 1:** `src/hooks/useClientesPaginated.ts`

Adicionar parâmetro opcional `filterByIds` para filtrar por IDs específicos:

```typescript
export interface ClientesPaginatedParams {
  page: number;
  pageSize: number;
  search?: string;
  ordenacao?: 'nome' | 'recente';
  filterByIds?: string[] | null; // NEW: para filtro CRM
}
```

Na query, aplicar o filtro:

```typescript
// Se tiver filtro por IDs, aplicar ANTES da paginação
if (filterByIds && filterByIds.length > 0) {
  countQuery = countQuery.in('id', filterByIds);
  dataQuery = dataQuery.in('id', filterByIds);
} else if (filterByIds !== null && filterByIds?.length === 0) {
  // Filtro ativo mas sem resultados
  return { data: [], count: 0, totalPages: 0 };
}
```

---

**Arquivo 2:** `src/hooks/useClientesCRMBatch.ts`

Modificar `useClientesCRMFilter` para retornar também a data do pedido pendente mais antigo, permitindo ordenação:

```typescript
// Para 'pendente', retornar objeto com {id, ultimoPedidoPendenteData}
// Permitir ordenação por mais antigo primeiro
```

Adicionar ordenação ao retorno:
```typescript
case 'pendente':
  if (stats.ultimoPedidoStatus?.toUpperCase() === 'PENDENTE') {
    matchingClients.push({
      id: clienteId,
      oldestPendingDate: stats.ultimoPedidoPendenteData
    });
  }
  break;

// Ordenar por data mais antiga primeiro
matchingClients.sort((a, b) => {
  if (!a.oldestPendingDate) return 1;
  if (!b.oldestPendingDate) return -1;
  return a.oldestPendingDate.getTime() - b.oldestPendingDate.getTime();
});

return matchingClients.map(c => c.id);
```

---

**Arquivo 3:** `src/pages/Clientes.tsx`

Alterar o uso de `useClientesPaginated` para passar os IDs filtrados:

```typescript
// Antes:
const { data: paginatedData } = useClientesPaginated({
  page: currentPage,
  pageSize: PAGE_SIZE,
  search: busca,
  ordenacao,
});

// Depois:
const { data: paginatedData } = useClientesPaginated({
  page: currentPage,
  pageSize: PAGE_SIZE,
  search: busca,
  ordenacao,
  filterByIds: filtroStatus !== 'todos' ? crmFilterIds : null,
});
```

Remover a filtragem client-side (não será mais necessária):

```typescript
// Antes:
const filteredClientes = useMemo(() => {
  if (!paginatedData?.data) return [];
  if (filtroStatus === 'todos' || !crmFilterIds) return paginatedData.data;
  return paginatedData.data.filter(c => crmFilterIds.includes(c.id));
}, [...]);

// Depois:
const filteredClientes = paginatedData?.data || [];
```

Atualizar o cálculo de paginação para usar os dados corretos:
```typescript
// totalCount e totalPages virão do paginatedData já filtrado
const totalCount = paginatedData?.count || 0;
const totalPages = paginatedData?.totalPages || 1;
```

---

### Ordenação para Pendentes

Quando o filtro for "Pendentes", a ordenação padrão será:
- **Mais antigo pendente primeiro** (baseado em `ultimoPedidoPendenteData`)
- Isso será garantido pela ordenação feita em `useClientesCRMFilter`
- A query paginada manterá a ordem dos IDs retornados

Para manter a ordem dos IDs, usaremos uma técnica de ordenação no Supabase:
```sql
ORDER BY array_position(ARRAY['id1', 'id2', ...], id)
```

Ou, alternativamente, ordenar client-side após a query.

---

### Fluxo Final

| Passo | Descrição |
|-------|-----------|
| 1 | Usuário clica em "Pendentes" |
| 2 | `useClientesCRMFilter('pendente')` busca todos os pedidos e retorna IDs de clientes com status_pagamento = 'PENDENTE', ordenados por data mais antiga |
| 3 | `useClientesPaginated` recebe esses IDs e faz `.in('id', ids).range(0, 23)` |
| 4 | Paginação mostra "1-24 de 50 clientes" (exemplo) |
| 5 | Busca continua funcionando dentro do conjunto filtrado |

---

### Critérios de Aceite

| Cenário | Resultado |
|---------|-----------|
| Clicar em Pendentes | Lista apenas clientes pendentes, paginação correta |
| Navegação de páginas | Mostra próximos pendentes, não volta ao total geral |
| Busca dentro de Pendentes | Filtra por nome/telefone dentre os pendentes |
| Outros filtros (VIP, Frequentes) | Funcionam com a mesma lógica |
| Filtro "Todos" | Mantém comportamento atual |

---

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useClientesPaginated.ts` | Adicionar parâmetro `filterByIds` |
| `src/hooks/useClientesCRMBatch.ts` | Ordenar pendentes por data mais antiga |
| `src/pages/Clientes.tsx` | Passar IDs para query paginada, remover filtragem client-side |
