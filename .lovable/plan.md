

## Plano: Adicionar Quantidade de Modelos e Taxa de Excursão no Modal e PDF

### Objetivo

Incluir no modal "Detalhes do Pedido" e no PDF gerado:
- Quantidade de modelos (calculada a partir dos itens com produto_id único)
- Taxa de Excursão (valor já salvo na tabela pedidos)

---

### Alterações Necessárias

#### 1. Arquivo: `src/hooks/usePedidosPaginated.ts`

**Adicionar campos ao tipo `PedidoPaginatedDB`:**

```typescript
export interface PedidoPaginatedDB {
  // ... campos existentes ...
  excursao_id: string | null;  // NOVO
  taxa_excursao: number | null; // NOVO
  // ...
}
```

---

#### 2. Arquivo: `src/pages/PedidosCriados.tsx`

##### 2.1 - Adicionar função para calcular quantidade de modelos

```typescript
// Calcular quantidade de modelos únicos no pedido
const calcularQuantidadeModelos = (itens: Array<{ produto_id?: string | null }>) => {
  const modelosUnicos = new Set(
    itens
      .filter(item => item.produto_id)
      .map(item => item.produto_id)
  );
  return modelosUnicos.size;
};
```

##### 2.2 - Atualizar seção "Totals" no modal (linhas 1235-1245)

**Antes:**
```
┌─────────────────────────────────────────────┐
│  Total de Peças         Valor Total         │
│  14 peças               R$ 460,00           │
└─────────────────────────────────────────────┘
```

**Depois:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Total de Peças    Qtd Modelos    Subtotal     Taxa Excursão  │ Total  │
│  14 peças          3 modelos      R$ 450,00    + R$ 10,00     │R$460,00│
└─────────────────────────────────────────────────────────────────────────┘
```

Código novo para a seção de totais:

```tsx
{/* Totals - Atualizado com grid */}
<div className="neu-card p-4 rounded-xl">
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {/* Total de Peças */}
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
        Total de Peças
      </p>
      <p className="text-2xl font-semibold leading-tight text-primary">
        {selectedPedido.total_pecas || 0} <span className="text-sm font-normal text-muted-foreground">peças</span>
      </p>
    </div>
    
    {/* Quantidade de Modelos */}
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
        Qtd de Modelos
      </p>
      <p className="text-2xl font-semibold leading-tight text-violet-600">
        {calcularQuantidadeModelos(selectedPedido.pedido_itens || [])} 
        <span className="text-sm font-normal text-muted-foreground">
          {calcularQuantidadeModelos(selectedPedido.pedido_itens || []) === 1 ? 'modelo' : 'modelos'}
        </span>
      </p>
    </div>
    
    {/* Taxa Excursão (condicional) */}
    {(selectedPedido.taxa_excursao || 0) > 0 && (
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
          Taxa Excursão
        </p>
        <p className="text-2xl font-semibold leading-tight text-amber-600">
          + {formatCurrency(selectedPedido.taxa_excursao || 0)}
        </p>
      </div>
    )}
    
    {/* Valor Total */}
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
        Valor Total
      </p>
      <p className="text-2xl font-semibold leading-tight text-emerald-600">
        {formatCurrency(selectedPedido.valor_total || 0)}
      </p>
    </div>
  </div>
</div>
```

##### 2.3 - Atualizar função `generatePDF` (linhas 534-636)

Adicionar na seção de totais do PDF:

```typescript
// Totals - Atualizado com quantidade de modelos e taxa excursão
const quantidadeModelos = calcularQuantidadeModelos(itens);
const taxaExcursao = pedido.taxa_excursao || 0;
const subtotalItens = itens.reduce((acc, item) => acc + (item.quantidade * item.valor_unitario), 0);

doc.setFillColor(240, 240, 240);
doc.rect(14, finalY, pageWidth - 28, 35, 'F');

doc.setFont('helvetica', 'bold');
doc.setFontSize(11);

// Linha 1: Peças e Modelos
doc.text(`Total de Peças: ${pedido.total_pecas || 0}`, 20, finalY + 10);
doc.text(`Quantidade de Modelos: ${quantidadeModelos}`, pageWidth / 2, finalY + 10);

// Linha 2: Subtotal e Taxa (se houver)
if (taxaExcursao > 0) {
  doc.text(`Subtotal dos Itens: ${formatCurrency(subtotalItens)}`, 20, finalY + 18);
  doc.text(`Taxa Excursão: + ${formatCurrency(taxaExcursao)}`, pageWidth / 2, finalY + 18);
}

// Linha 3: Valor Total
doc.setFontSize(12);
doc.text(`Valor Total: ${formatCurrency(pedido.valor_total || 0)}`, 20, finalY + 28);
```

---

### Resultado Visual Esperado

#### Modal "Detalhes do Pedido"

```
┌──────────────────────────────────────────────────────────────────┐
│  TOTAL DE PEÇAS    QTD DE MODELOS    TAXA EXCURSÃO   VALOR TOTAL │
│  14 peças          3 modelos         + R$ 10,00      R$ 460,00   │
└──────────────────────────────────────────────────────────────────┘
```

#### PDF Gerado

```
┌──────────────────────────────────────────────────────────────────┐
│  Total de Peças: 14          Quantidade de Modelos: 3            │
│  Subtotal dos Itens: R$ 450,00    Taxa Excursão: + R$ 10,00      │
│  Valor Total: R$ 460,00                                          │
└──────────────────────────────────────────────────────────────────┘
```

---

### Resumo de Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/usePedidosPaginated.ts` | Adicionar `taxa_excursao` e `excursao_id` ao tipo |
| `src/pages/PedidosCriados.tsx` | Adicionar função `calcularQuantidadeModelos`, atualizar modal de detalhes e função `generatePDF` |

