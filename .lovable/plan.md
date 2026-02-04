
## Plano: Importar Excursões via CSV

### Estrutura do CSV Detectada

| Coluna | Mapeamento |
|--------|------------|
| `EXCURSAO` | Nome da excursão |
| `VALOR COBRADO EXCURSAO` | Taxa (R$ 10,00) |

### Desafios Identificados

1. **Duplicatas no arquivo**: O CSV tem 181 linhas mas muitas são a mesma excursão repetida:
   - "Cabanas turismo", "Cabana turismo", "CABANA TUR", "Cabana Tur" → mesmo nome
   - "Noelia tur", "Noelia tour", "Noelia Tour", "Noélia tur" → mesmo nome

2. **Formato do valor**: Precisa converter "R$ 10,00" → 10.00

### Componentes a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/excursoes/ImportExcursoesCSVModal.tsx` | Modal de importação com drag & drop |
| `src/hooks/useExcursoesBatchImport.ts` | Hook para importação em lote |
| `src/lib/csv-validation-schemas.ts` | Adicionar schema de validação para excursões |

### Funcionamento

#### 1. Parsing do CSV
```typescript
// Detectar colunas: EXCURSAO, VALOR COBRADO EXCURSAO
// Converter "R$ 10,00" → 10.00 usando safeParseNumber
```

#### 2. Normalização e Deduplicação
```typescript
// Normalizar: remover espaços extras, lowercase para comparação
// Agrupar duplicatas e usar o valor mais comum
// Mapa de exemplo:
// "cabana turismo" → { nome: "Cabana Turismo", taxa: 10.00 }
// "noelia tur" → { nome: "Noelia Tur", taxa: 10.00 }
```

#### 3. Importação em Lote
- Verificar excursões já existentes no banco
- Importar apenas novas
- Mostrar progresso durante importação

### Interface do Modal

```
┌─────────────────────────────────────────────────────┐
│ 📊 Importar Excursões                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │     📤 Clique ou arraste o arquivo CSV      │    │
│  │                                             │    │
│  │     Formato: EXCURSAO, VALOR                │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ⚠️ Formato esperado das colunas:                   │
│     • EXCURSAO → Nome da excursão                  │
│     • VALOR COBRADO EXCURSAO → R$ 10,00            │
│                                                     │
│  Duplicatas serão automaticamente agrupadas         │
│                                                     │
│  [ Cancelar ]                                       │
└─────────────────────────────────────────────────────┘
```

### Alterações na Página ConfigExcursoes

Adicionar botão "Importar CSV" ao lado de "Nova Excursão":

```typescript
<div className="flex justify-end gap-2">
  <Button variant="outline" onClick={() => setShowImportModal(true)}>
    <Upload size={18} />
    Importar CSV
  </Button>
  <Button onClick={handleOpenNew}>
    <Plus size={18} />
    Nova Excursão
  </Button>
</div>
```

### Validação Zod (adicionar ao csv-validation-schemas.ts)

```typescript
export const ExcursaoCSVRowSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório').max(255, 'Nome muito longo'),
  taxa: z.number().min(0, 'Taxa inválida').max(1000, 'Taxa muito alta'),
});
```

### Resultado Esperado

Com o CSV fornecido (182 linhas):
- ~30-40 excursões únicas após deduplicação
- Valores automaticamente convertidos de "R$ 10,00" → 10.00
- Nomes normalizados (primeira letra maiúscula)

### Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/excursoes/ImportExcursoesCSVModal.tsx` | **Criar** - Modal de importação |
| `src/hooks/useExcursoesBatchImport.ts` | **Criar** - Hook de importação em lote |
| `src/lib/csv-validation-schemas.ts` | **Modificar** - Adicionar schema |
| `src/pages/ConfigExcursoes.tsx` | **Modificar** - Adicionar botão e modal |
