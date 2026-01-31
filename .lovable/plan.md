

## Plano: Filtros Multi-Seleção em Pedidos Criados

### Objetivo

Permitir que o usuário selecione **múltiplos valores** em cada filtro de status (Pagamento, Pedido, Entrega), em vez de apenas um valor por vez.

**Exemplo de uso:**
- Selecionar "PENDENTE" + "INCOMPLETO" no Status Pagamento
- Selecionar "NÃO SEPARADO" + "AMANHÃ" no Status Pedido

---

## Alterações Necessárias

### 1. Mudança no Tipo de Estado

| Antes | Depois |
|-------|--------|
| `filterStatusPagamento: string` | `filterStatusPagamento: string[]` |
| `filterStatusPedido: string` | `filterStatusPedido: string[]` |
| `filterStatusEntrega: string` | `filterStatusEntrega: string[]` |

**Valor padrão:** `[]` (array vazio = "Todos")

---

### 2. Componente Multi-Select (Novo)

Criar componente reutilizável `StatusMultiSelect` que:

- Exibe checkboxes para cada opção
- Mostra contador de selecionados no trigger (ex: "2 selecionados")
- Permite selecionar/desselecionar todos
- Usa Popover com lista de Checkbox

**Interface proposta:**

```text
┌─────────────────────────────────┐
│ Pagamento        ▼              │
│ 2 selecionados                  │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ ☐ Selecionar todos              │
├─────────────────────────────────┤
│ ☑ PENDENTE                      │
│ ☐ PAGO                          │
│ ☑ INCOMPLETO                    │
│ ☐ CANCELADO                     │
│ ☐ PEND. ENTREGA                 │
│ ☐ GOLPE CANCELADO               │
└─────────────────────────────────┘
```

---

### 3. Alterações nos Hooks de Dados

**`usePedidosPaginated.ts`**

- Mudar interface `PaginatedParams`:
```typescript
statusPagamento?: string[];  // Antes: string
statusPedido?: string[];     // Antes: string  
statusEntrega?: string[];    // Antes: string
```

- Mudar lógica de filtro:
```typescript
// Antes (single)
if (params.statusPagamento && params.statusPagamento !== 'all') {
  query = query.eq('status_pagamento', params.statusPagamento);
}

// Depois (multi)
if (params.statusPagamento && params.statusPagamento.length > 0) {
  query = query.in('status_pagamento', params.statusPagamento);
}
```

**`usePedidosTotals.ts`**

- Mesmas alterações de interface e lógica

---

### 4. Alterações na Página PedidosCriados.tsx

**Estados:**

```typescript
// Antes
const [filterStatusPagamento, setFilterStatusPagamento] = useState('all');

// Depois  
const [filterStatusPagamento, setFilterStatusPagamento] = useState<string[]>([]);
```

**Persistência no localStorage:**

```typescript
interface PersistedFilters {
  filterStatusPagamento: string[];  // Antes: string
  filterStatusPedido: string[];     // Antes: string
  filterStatusEntrega: string[];    // Antes: string
  // ... outros campos mantidos
}
```

**Quick Filters:**

Ajustar para trabalhar com arrays:
```typescript
// Antes
setFilterStatusPagamento('PENDENTE');

// Depois
setFilterStatusPagamento(['PENDENTE']);
```

**UI dos filtros:**

Substituir os `Select` por `StatusMultiSelect`:
```tsx
// Antes
<Select value={filterStatusPagamento} onValueChange={setFilterStatusPagamento}>

// Depois
<StatusMultiSelect
  label="Pagamento"
  options={statusPagamentoOptions}
  selected={filterStatusPagamento}
  onSelectionChange={setFilterStatusPagamento}
/>
```

---

### 5. Alterações no MobileFiltersSheet

Mesmas alterações de UI, substituindo `Select` por `StatusMultiSelect`.

---

### 6. Exportação CSV

Ajustar a query de exportação para usar `.in()` quando filtros multi-seleção estiverem ativos.

---

## Arquivos Impactados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/pedidos/StatusMultiSelect.tsx` | **Novo** - Componente multi-select |
| `src/pages/PedidosCriados.tsx` | Estados, UI, quick filters, persistência |
| `src/hooks/usePedidosPaginated.ts` | Interface e lógica de filtro |
| `src/hooks/usePedidosTotals.ts` | Interface e lógica de filtro |
| `src/components/pedidos/MobileFiltersSheet.tsx` | Props e UI |

---

## Comportamento do Multi-Select

| Seleção | Trigger mostra | Query no banco |
|---------|----------------|----------------|
| Nenhum | "Todos Pagamentos" | Sem filtro (retorna todos) |
| 1 item | "PENDENTE" | `.eq('status_pagamento', 'PENDENTE')` |
| 2+ itens | "2 selecionados" | `.in('status_pagamento', ['PENDENTE', 'PAGO'])` |
| Todos | "Todos Pagamentos" | Sem filtro (otimização) |

---

## Migração de Dados (localStorage)

Para compatibilidade com filtros antigos salvos (string), a função `loadPersistedFilters` deve converter:

```typescript
// Se valor antigo for string, converter para array
if (typeof parsed.filterStatusPagamento === 'string') {
  parsed.filterStatusPagamento = 
    parsed.filterStatusPagamento === 'all' ? [] : [parsed.filterStatusPagamento];
}
```

---

## Critérios de Aceite

- Cada filtro de status permite selecionar múltiplos valores
- Trigger mostra quantidade de selecionados
- "Nenhum selecionado" = todos os registros (sem filtro)
- Quick filters continuam funcionando
- Persistência no localStorage funciona
- Contagem de filtros ativos reflete corretamente
- Exportação CSV respeita multi-seleção
- Mobile e desktop funcionam corretamente

