

## Plano: Permitir Salvar Ajuste Sem Alteração de Quantidade

### Objetivo

Remover a restrição que impede salvar quando a diferença é zero, permitindo registrar ajustes mesmo sem mudança na quantidade (útil para registrar conferências, auditorias, etc.).

---

### Alteração no Arquivo

**Arquivo:** `src/components/estoque/AjusteEstoqueModal.tsx`

**Linha 92** - Remover a condição `!semAlteracao`:

```typescript
// ANTES
const isValid = novaQtd >= 0 && estoqueAtualInt >= 0 && tipoAjusteId.length > 0 && !semAlteracao;

// DEPOIS
const isValid = novaQtd >= 0 && estoqueAtualInt >= 0 && tipoAjusteId.length > 0;
```

---

### Comportamento Esperado

| Cenário | Diferença | Pode Salvar? |
|---------|-----------|--------------|
| Entrada (+5 peças) | +5 | ✅ Sim |
| Saída (-3 peças) | -3 | ✅ Sim |
| Conferência (sem alteração) | 0 | ✅ Sim |

---

### Resumo

| Arquivo | Alteração |
|---------|-----------|
| `src/components/estoque/AjusteEstoqueModal.tsx` | Remover `&& !semAlteracao` da validação (linha 92) |

