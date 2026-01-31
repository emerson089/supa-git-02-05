

## Plano: Corrigir Sobreposição de Texto no PDF

### Diagnóstico do Problema

Analisando o código e o PDF gerado, identifiquei 3 problemas:

1. **Status Y Position Errada**: O status está usando `finalY + 20` quando tem taxa, mas essa posição conflita com a linha da Taxa Excursão (que está em `finalY + 18`)
2. **Footer Position Fixa**: O footer usa `finalY + 35` fixo, mas quando tem taxa o box tem 35px de altura, então o footer deve estar em `finalY + boxHeight + 10`
3. **Linha 2 conflitante**: Taxa Excursão e Status estão tentando ocupar a mesma linha

---

### Solução

Reorganizar o layout do box de totais com posições bem definidas:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Linha 1 (finalY + 10): Total Peças          Quantidade de Modelos   │
│ Linha 2 (finalY + 18): Subtotal dos Itens   Taxa Excursão           │
│ Linha 3 (finalY + 26): Valor Total          Status (lado direito)   │
└──────────────────────────────────────────────────────────────────────┘
                        (finalY + boxHeight + 8): Footer
```

---

### Alterações no Arquivo

**Arquivo:** `src/pages/PedidosCriados.tsx`

**Linhas a modificar:** 619-654

#### Código Corrigido

```typescript
// Totals - altura dinâmica baseada na presença de taxa
const boxHeight = taxaExcursao > 0 ? 38 : 28;
doc.setFillColor(240, 240, 240);
doc.rect(14, finalY, pageWidth - 28, boxHeight, 'F');
doc.setFont('helvetica', 'bold');
doc.setFontSize(11);

// Linha 1: Peças e Modelos
doc.text(`Total de Peças: ${pedido.total_pecas || 0}`, 20, finalY + 10);
doc.text(`Quantidade de Modelos: ${quantidadeModelos}`, pageWidth / 2, finalY + 10);

// Linha 2: Subtotal e Taxa (se houver)
if (taxaExcursao > 0) {
  doc.text(`Subtotal dos Itens: ${formatCurrency(subtotalItens)}`, 20, finalY + 18);
  doc.text(`Taxa Excursão: + ${formatCurrency(taxaExcursao)}`, pageWidth / 2, finalY + 18);
  
  // Linha 3: Valor Total e Status
  doc.setFontSize(12);
  doc.text(`Valor Total: ${formatCurrency(pedido.valor_total || 0)}`, 20, finalY + 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Status: ${pedido.status_pagamento} | ${pedido.status_pedido} | ${pedido.status_entrega}`, pageWidth - 20, finalY + 28, {
    align: 'right'
  });
} else {
  // Sem taxa: Valor Total e Status na linha 2
  doc.setFontSize(12);
  doc.text(`Valor Total: ${formatCurrency(pedido.valor_total || 0)}`, 20, finalY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Status: ${pedido.status_pagamento} | ${pedido.status_pedido} | ${pedido.status_entrega}`, pageWidth - 20, finalY + 18, {
    align: 'right'
  });
}

// Footer - posição dinâmica baseada na altura do box
doc.setFont('helvetica', 'italic');
doc.setFontSize(10);
doc.text('Obrigado pela preferência! Delookii Jeans', pageWidth / 2, finalY + boxHeight + 10, {
  align: 'center'
});
```

---

### Resultado Visual Esperado

**Com Taxa de Excursão:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  Total de Peças: 16               Quantidade de Modelos: 4          │
│  Subtotal dos Itens: R$ 560,00    Taxa Excursão: + R$ 10,00         │
│  Valor Total: R$ 570,00           Status: PENDENTE | NÃO SEP | ...  │
└──────────────────────────────────────────────────────────────────────┘
              Obrigado pela preferência! Delookii Jeans
```

**Sem Taxa de Excursão:**
```
┌──────────────────────────────────────────────────────────────────────┐
│  Total de Peças: 16               Quantidade de Modelos: 4          │
│  Valor Total: R$ 560,00           Status: PENDENTE | NÃO SEP | ...  │
└──────────────────────────────────────────────────────────────────────┘
              Obrigado pela preferência! Delookii Jeans
```

---

### Resumo das Mudanças

| Problema | Correção |
|----------|----------|
| Status sobrepondo Taxa | Mover Status para a mesma linha do Valor Total (linha 3) |
| Footer com posição fixa | Usar `finalY + boxHeight + 10` para posição dinâmica |
| Box height insuficiente | Aumentar de 35 para 38px quando tem taxa |

---

### Arquivos Impactados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/PedidosCriados.tsx` | Corrigir posições Y dos elementos no PDF (linhas 619-654) |

