

## Plano: Corrigir Card "Estoque Crítico" no Dashboard

### Problema Identificado

O card "Estoque Crítico" não exibe itens porque a lógica depende de `quantidade_minima` estar configurado, mas **nenhum dos 158 itens no estoque tem esse valor preenchido** (todos = 0).

**Dados atuais:**
| Situação | Quantidade de Itens |
|----------|---------------------|
| Estoque = 0 | 42 itens |
| Estoque ≤ 5 | 3 itens |
| Estoque ≤ 10 | 14 itens |
| quantidade_minima > 0 | 0 itens |

**Lógica atual (problemática):**
```typescript
.filter(item => item.quantidade < (item.quantidade_minima || 0))
// Resultado: 0 < 0 = false → nenhum item passa
```

---

### Solução Proposta

Implementar uma lógica de **fallback inteligente** quando `quantidade_minima` não está configurado:

1. **Se quantidade_minima > 0**: usar a lógica original (quantidade < quantidade_minima)
2. **Se quantidade_minima = 0 (não configurado)**: considerar crítico se:
   - Quantidade = 0 (zerado)
   - Quantidade ≤ 10 (baixo estoque genérico)

**Nova lógica:**
```typescript
.filter(item => {
  const minimo = item.quantidade_minima || 0;
  
  // Se tem mínimo configurado, usar ele como referência
  if (minimo > 0) {
    return item.quantidade < minimo;
  }
  
  // Fallback: considerar crítico se zerado ou ≤ 10 peças
  return item.quantidade <= 10;
})
```

---

### Alterações Técnicas

#### Arquivo: `src/hooks/useDashboardData.ts`

**Modificar linhas 600-608** - Atualizar filtro de estoque crítico:

```typescript
// Estoque baixo - CORRIGIDO: fallback quando quantidade_minima não está configurada
const estoqueData = estoque.data || [];
const estoqueBaixo: EstoqueBaixoItem[] = estoqueData
  .filter(item => {
    const minimo = item.quantidade_minima || 0;
    
    // Se tem mínimo configurado, usar como referência
    if (minimo > 0) {
      return item.quantidade < minimo;
    }
    
    // Fallback: considerar crítico se quantidade <= 10 (típico para moda)
    // Priorizar zerados primeiro
    return item.quantidade <= 10;
  })
  .sort((a, b) => {
    // Ordenar: zerados primeiro, depois por quantidade crescente
    if (a.quantidade === 0 && b.quantidade !== 0) return -1;
    if (a.quantidade !== 0 && b.quantidade === 0) return 1;
    return a.quantidade - b.quantidade;
  })
  .map(item => ({
    ...item,
    status: getEstoqueStatus(item.quantidade),
  }))
  .slice(0, 5);
```

#### Atualizar função `getEstoqueStatus`

**Modificar linhas 252-256** - Adicionar categoria "baixo" para itens com estoque baixo mas não zerado:

```typescript
function getEstoqueStatus(quantidade: number): "baixo" | "zerado" | "negativo" {
  if (quantidade < 0) return "negativo";
  if (quantidade === 0) return "zerado";
  return "baixo"; // Retorna "baixo" para qualquer quantidade positiva que passou no filtro
}
```

---

### Resultado Esperado

Após a correção, o card "Estoque Crítico" exibirá:

| Item | Quantidade | Status |
|------|------------|--------|
| Saia Midi Bolso Cargo 397 | 0 | Zerado |
| Bermuda jeans cargo feminina | 0 | Zerado |
| Short bordado 229 | 0 | Zerado |
| Short alfaiataria amarelo | 0 | Zerado |
| Short Saia Jeans Cargo | 0 | Zerado |

Com os botões de ação correspondentes para repor ou produzir.

---

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useDashboardData.ts` | Atualizar lógica de filtro para estoque crítico com fallback |

---

### Critérios de Aceite

| Cenário | Resultado Esperado |
|---------|-------------------|
| Item com quantidade = 0 | Exibido como "Zerado" |
| Item com quantidade ≤ 10 | Exibido como "Baixo" (se quantidade_minima não configurado) |
| Item com quantidade_minima configurado | Usar lógica original (quantidade < quantidade_minima) |
| Card vazio | Não deve acontecer se houver itens zerados |

