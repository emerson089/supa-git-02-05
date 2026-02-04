

## Plano: Corrigir Importação CSV + Botão Excluir Tudo

### Problemas Identificados

1. **Separador errado**: O parser usa `;` mas o CSV usa `,`
2. **Campos com aspas**: `"Estrela Dalva, setor laranja"` e `"10,00"` não são tratados
3. **Falta seleção em massa**: Não há como excluir todas as excursões de uma vez

### Solução

#### 1. Corrigir Parser CSV (`useExcursoesBatchImport.ts`)

Implementar um parser CSV robusto que:
- Detecta automaticamente o separador (`,` ou `;`)
- Trata campos entre aspas corretamente
- Processa valores como `"10,00"` → 10.00

```text
Antes:  "estrela Dalva, Setor Laranja, Vaga 44","r$ 10,00" → Nome: ??   Taxa: ??
Depois: "estrela Dalva, Setor Laranja, Vaga 44","10,00"    → Nome: Estrela Dalva   Taxa: 10.00
```

#### 2. Adicionar Botão "Excluir Tudo" (`ConfigExcursoes.tsx`)

- Checkbox "Selecionar Tudo" no topo da lista
- Modal de confirmação para exclusão em massa
- Hook `useDeleteAllExcursoes` para excluir em lote

### Mudanças em Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useExcursoesBatchImport.ts` | Corrigir parser CSV para usar vírgula e tratar aspas |
| `src/hooks/useExcursoes.ts` | Adicionar hook `useDeleteAllExcursoes` |
| `src/pages/ConfigExcursoes.tsx` | Adicionar checkbox + modal de exclusão em massa |

### Interface Atualizada

```text
┌────────────────────────────────────────────────────────────┐
│ EXCURSÕES                                                   │
│ Gerencie as excursões e suas taxas de envio                │
│                                                             │
│ [ ] Selecionar Tudo (45)    [🗑️ Excluir Selecionadas]      │
│                                                             │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ [✓] 🚌 Estrela Dalva, Setor Laranja, Vaga 44           │ │
│ │     Taxa: R$ 10,00                        [ON] ✏️ 🗑️   │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ [✓] 🚌 Cabanas Setor Verde                              │ │
│ │     Taxa: R$ 10,00                        [ON] ✏️ 🗑️   │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### Novo Parser CSV

```typescript
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}
```

### Exemplo de Resultado Corrigido

| CSV Original | Nome Extraído | Taxa |
|--------------|---------------|------|
| `Cabanas turismo,"10,00"` | Cabanas Turismo | R$ 10,00 |
| `"Estrela Dalva, setor laranja, vaga 44","10,00"` | Estrela Dalva, Setor Laranja, Vaga 44 | R$ 10,00 |
| `Dege tur,"5,00"` | Dege Tur | R$ 5,00 |

