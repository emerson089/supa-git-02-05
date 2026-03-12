

## Adicionar opção "ENTREGA TORITAMA" ao status de entrega

Adicionar a nova opção em todos os locais onde os status de entrega são definidos:

### Arquivos a alterar

1. **`src/components/pedidos/StatusSelector.tsx`** — Adicionar `{ value: 'ENTREGA TORITAMA', label: 'ENTREGA TORITAMA', color: 'purple' }` ao array `statusEntregaOptions`.

2. **`src/lib/csv-validation-schemas.ts`** — Adicionar `'ENTREGA TORITAMA'` ao array `STATUS_ENTREGA_VALUES`.

3. **`src/components/pedidos/MobileFiltersSheet.tsx`** e **`src/hooks/usePedidosPaginated.ts`** — Verificar se usam os arrays centralizados (provavelmente sim, sem alteração necessária).

A cor `purple` foi escolhida para diferenciar visualmente, similar ao "NO CARRO". Posso ajustar se preferir outra cor.

