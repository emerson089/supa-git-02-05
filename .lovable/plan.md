

## Plano: Ajustar Exportação CSV para Corresponder às Colunas Visíveis

### Problema Atual

O CSV atual exporta colunas que **não aparecem** na tabela visível:
- Telefone
- Cidade  
- Estado

E as colunas visíveis na tabela são:
- **DATA** - Data do pedido
- **CLIENTE** - Nome do cliente
- **MODELOS** - Itens do pedido (em branco se vazio)
- **QTD** - Quantidade total de peças
- **VALOR** - Valor total
- **PAGAMENTO** - Status de pagamento
- **PEDIDO** - Status do pedido
- **ENTREGA** - Status de entrega

---

### Solução

Alterar a função `exportCSV` no arquivo `src/pages/PedidosCriados.tsx` (linhas 707-708) para:

1. Remover colunas não visíveis (Telefone, Cidade, Estado)
2. Manter colunas visíveis na mesma ordem da tabela
3. Deixar em branco campos vazios (sem fallbacks)

---

### Alteração no Código

**Linha 707 - Headers:**
```typescript
// Antes
const headers = ['Data', 'Cliente', 'Telefone', 'Cidade', 'Estado', 'Itens', 'Qtd Total', 'Valor Total', 'Status Pagamento', 'Status Pedido', 'Status Entrega'];

// Depois
const headers = ['Data', 'Cliente', 'Modelos', 'Qtd', 'Valor', 'Pagamento', 'Pedido', 'Entrega'];
```

**Linha 708 - Rows:**
```typescript
// Antes
const rows = allPedidos.map(pedido => [
  format(new Date(pedido.created_at), "dd/MM/yyyy HH:mm"), 
  pedido.cliente_nome, 
  pedido.telefone || '', 
  pedido.cidade || '', 
  pedido.estado || '', 
  (pedido.pedido_itens || []).map(i => `${i.produto_nome}(${i.quantidade})`).join('; '), 
  (pedido.total_pecas || 0).toString(), 
  (pedido.valor_total || 0).toFixed(2), 
  pedido.status_pagamento || 'Pendente', 
  pedido.status_pedido || 'Nao separado', 
  pedido.status_entrega || 'Pend. Entrega'
]);

// Depois
const rows = allPedidos.map(pedido => [
  format(new Date(pedido.created_at), "dd/MM/yyyy"),
  pedido.cliente_nome || '',
  (pedido.pedido_itens || []).map(i => `${i.produto_nome}(${i.quantidade})`).join('; '),
  pedido.total_pecas?.toString() || '',
  pedido.valor_total?.toFixed(2) || '',
  pedido.status_pagamento || '',
  pedido.status_pedido || '',
  pedido.status_entrega || ''
]);
```

---

### Comparação: Antes vs Depois

| Coluna no CSV (Antes) | Coluna no CSV (Depois) |
|-----------------------|------------------------|
| Data (com hora) | Data (sem hora, como na tabela) |
| Cliente | Cliente |
| Telefone | **Removido** |
| Cidade | **Removido** |
| Estado | **Removido** |
| Itens | Modelos |
| Qtd Total | Qtd |
| Valor Total | Valor |
| Status Pagamento | Pagamento |
| Status Pedido | Pedido |
| Status Entrega | Entrega |

---

### Comportamento dos Campos Vazios

| Campo | Se vazio no banco | Resultado no CSV |
|-------|-------------------|------------------|
| Cliente | null | Em branco |
| Modelos | sem itens | Em branco |
| Qtd | null | Em branco |
| Valor | null | Em branco |
| Pagamento | null | Em branco |
| Pedido | null | Em branco |
| Entrega | null | Em branco |

---

### Arquivo Impactado

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/PedidosCriados.tsx` | Linhas 707-708 - Ajustar headers e mapeamento |

---

### Resultado Esperado

O CSV exportado terá exatamente as mesmas colunas visíveis na tabela:

```
Data,Cliente,Modelos,Qtd,Valor,Pagamento,Pedido,Entrega
12/01/2026,"Adaiane Lima","Saia Jeans Curta Cintura Alta 48...",34,1356.00,PAGO,SEPARADO,ENTREGUE
12/01/2026,"Zuleide Santana","Calça Cargo Jeans Clara 650 - 6...",98,4176.00,PAGO,SEPARADO,ENTREGUE
08/01/2026,"Luane Jesus","",20,828.00,PAGO,SEPARADO,ENTREGUE
```

