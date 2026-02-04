

## Plano: Corrigir Exibição de Produto e Referência no PDF

### Problemas Identificados

Analisando o PDF gerado e o código:

1. **Regex de extração incorreto**: A função `extrairCodigo` só captura referências no padrão `Nome - 123` (com traço). Nomes como `Short jeans vintage 574` não são detectados.

2. **Truncamento excessivo**: Nomes são cortados em 27 caracteres, perdendo informação importante.

3. **Colunas podem estar colapsando**: A largura `auto` pode não estar funcionando corretamente quando há muitas colunas.

### Solução

#### 1. Melhorar a função `extrairCodigo` para detectar referências em múltiplos padrões

**De:**
```typescript
function extrairCodigo(nome: string): { nome: string; codigo: string } {
  const match = nome.match(/\s*-\s*(\d+)$/);
  if (match) {
    return {
      nome: nome.replace(/\s*-\s*\d+$/, '').trim(),
      codigo: match[1],
    };
  }
  return { nome, codigo: '-' };
}
```

**Para:**
```typescript
function extrairCodigo(nome: string): { nome: string; codigo: string } {
  // Padrão 1: "Nome - 123" (com traço)
  const matchTraco = nome.match(/\s*-\s*(\d+)$/);
  if (matchTraco) {
    return {
      nome: nome.replace(/\s*-\s*\d+$/, '').trim(),
      codigo: matchTraco[1],
    };
  }
  
  // Padrão 2: "Nome 123" (número no final sem traço)
  const matchFinal = nome.match(/\s+(\d{3,})$/);
  if (matchFinal) {
    return {
      nome: nome.replace(/\s+\d{3,}$/, '').trim(),
      codigo: matchFinal[1],
    };
  }
  
  return { nome, codigo: '-' };
}
```

#### 2. Aumentar limite de caracteres do nome (de 30 para 45)

**De:**
```typescript
{ content: nome.length > 30 ? nome.substring(0, 27) + '...' : nome },
```

**Para:**
```typescript
{ content: nome.length > 45 ? nome.substring(0, 42) + '...' : nome },
```

#### 3. Ajustar larguras das colunas para melhor distribuição

```typescript
const columnStyles = {
  0: { cellWidth: 14, halign: 'center' as const },   // Foto (um pouco menor)
  1: { cellWidth: 'auto' as const },                  // Produto (expande)
  2: { cellWidth: 14, halign: 'center' as const },   // Código
  3: { cellWidth: 12, halign: 'center' as const },   // Qtd
  4: { cellWidth: 20, halign: 'right' as const },    // Preço
};
```

### Exemplos de Extração Corrigida

| Nome Original | Nome Extraído | Código |
|---------------|---------------|--------|
| `Short jeans vintage 574` | `Short jeans vintage` | `574` |
| `Short Saia jeans frente e traseira - 385` | `Short Saia jeans frente e traseira` | `385` |
| `PLS Saia Cargo Jeans 540` | `PLS Saia Cargo Jeans` | `540` |
| `Short jeans bordado` | `Short jeans bordado` | `-` |

### Resultado Visual Esperado

```
┌──────┬───────────────────────────────────────┬──────┬─────┬──────────┐
│      │ Produto                               │ Cód  │ Qtd │  Preço   │
├──────┼───────────────────────────────────────┼──────┼─────┼──────────┤
│[foto]│ Short Saia jeans frente e traseira    │ 385  │  10 │ R$ 29,90 │
│[foto]│ Short jeans vintage                   │ 574  │   5 │ R$ 34,90 │
│[foto]│ PLS Saia Cargo Jeans                  │ 540  │   8 │ R$ 49,90 │
│[foto]│ Short jeans bordado                   │  -   │  12 │ R$ 27,90 │
└──────┴───────────────────────────────────────┴──────┴─────┴──────────┘
```

### Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/utils/generateCargaPDF.ts` | Melhorar extração de código, aumentar limite de nome, ajustar larguras |

