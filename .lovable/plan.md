

## Plano: Ajustar PDF - Preço Sempre Visível, Ocultar Apenas Total

### Novo Comportamento

| Modo | Tabela | Resumo |
|------|--------|--------|
| **Padrão** | Foto, Produto, Cód, Qtd, Preço | `8 modelos \| 636 peças \| R$ 18.710,00` |
| **Ocultar valores** | Foto, Produto, Cód, Qtd, **Preço** ✅ | `8 modelos \| 636 peças` (sem total) |

### Mudanças em `src/utils/generateCargaPDF.ts`

#### 1. Remover Subtotal da tabela (sempre)

A tabela terá **sempre 5 colunas**: Foto, Produto, Cód, Qtd, Preço

```typescript
// Linha ~245-260: Remover lógica condicional de colunas
tableData.push([
  { content: '', styles: { cellWidth: 16 } },  // Foto
  { content: nome... },                         // Produto
  { content: codigo... },                       // Código
  { content: String(qtd)... },                  // Qtd
  { content: formatCurrency(preco)... },        // Preço (SEMPRE)
]);
```

#### 2. Cabeçalho fixo (sem condicional)

```typescript
// Linha ~283
const tableHeaders = [['', 'Produto', 'Cód', 'Qtd', 'Preço']];
```

#### 3. columnStyles fixo (sem condicional)

```typescript
// Linhas ~266-279
const columnStyles = {
  0: { cellWidth: 16, halign: 'center' as const },  // Foto
  1: { cellWidth: 'auto' as const },                 // Produto
  2: { cellWidth: 16, halign: 'center' as const },  // Código
  3: { cellWidth: 14, halign: 'center' as const },  // Qtd
  4: { cellWidth: 22, halign: 'right' as const },   // Preço
};
```

#### 4. hideFinancials afeta APENAS o resumo (linhas ~181-195)

```typescript
// Resumo - hideFinancials controla apenas o valor total
if (hideFinancials) {
  const resumoText = `${totais.totalItens} modelos  |  ${totais.totalPecas} peças`;
  doc.text(resumoText, margin + 25, yPos + 10);
} else {
  const resumoText = `${totais.totalItens} modelos  |  ${totais.totalPecas} peças  |  `;
  doc.text(resumoText, margin + 25, yPos + 10);
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(formatCurrency(totais.valorTotal), margin + 25 + doc.getTextWidth(resumoText), yPos + 10);
}
```

### Resultado Visual

**Tabela (SEMPRE igual):**
```
┌──────┬──────────────────────────┬──────┬─────┬──────────┐
│      │ Produto                  │ Cód  │ Qtd │  Preço   │
├──────┼──────────────────────────┼──────┼─────┼──────────┤
│[foto]│ Short cinto encapado...  │ 124  │ 108 │ R$ 29,90 │
│[foto]│ Calça Alfaiataria...     │ 280  │  30 │ R$ 49,90 │
└──────┴──────────────────────────┴──────┴─────┴──────────┘
```

**Resumo (padrão):**
```
┌────────────────────────────────────────────────────────┐
│ RESUMO: 8 modelos  |  636 peças  |  R$ 18.710,00      │
└────────────────────────────────────────────────────────┘
```

**Resumo (ocultar valores):**
```
┌────────────────────────────────────────────────────────┐
│ RESUMO: 8 modelos  |  636 peças                       │
└────────────────────────────────────────────────────────┘
```

### Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/utils/generateCargaPDF.ts` | Remover Subtotal, manter Preço sempre, hideFinancials só no resumo |

