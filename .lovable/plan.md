

## Plano: Substituir Progresso Manual por Progresso de Etapas

### Problema

A barra "Progresso 0/2" rastreia `pecas_concluidas` manualmente dentro de uma etapa. Na prática, ninguém usa — o lote inteiro avança junto e o campo fica sempre em 0.

### Solução

Substituir por uma **barra de progresso das etapas** que mostra visualmente em qual das 8 etapas o lote está. Isso é automático (baseado em `processo_atual`) e não requer input manual.

### Visual Proposto

```text
Antes:
  Progresso           0/2
  [==                    ]

Depois:
  Etapa 3 de 8 — Travete
  [========              ]
```

A barra preenche proporcionalmente (ex: etapa 3 de 8 = 37.5%).

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/production/ProductionCard.tsx` | Substituir seção "Progress Bar" (linhas 242-276) por barra de etapas usando `getStageIndex(lot.processo_atual)` e `STAGES.length` |
| `src/components/production/MobileProductionCard.tsx` | Mesma alteração na versão mobile (seção de progress bar) |

### O Que Remove

- Campo `pecas_concluidas` deixa de ser editável no card (continua no banco, sem perda de dados)
- Remove dependência de input manual para exibir progresso
- Remove state `editingProgress` e `tempPecas` dos componentes

### Implementacao

```typescript
// Cálculo automático baseado na etapa atual
const currentStageIndex = getStageIndex(lot.processo_atual);
const stageProgress = ((currentStageIndex + 1) / STAGES.length) * 100;
const currentStageLabel = STAGES[currentStageIndex]?.label || lot.processo_atual;
```

```tsx
{/* Progresso por Etapas */}
<div className="mb-4">
  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
    <span>Etapa {currentStageIndex + 1} de {STAGES.length}</span>
    <span className="font-medium">{currentStageLabel}</span>
  </div>
  <Progress value={stageProgress} className="h-2" />
</div>
```

### Impacto

- **Zero mudança no banco** — nenhuma migração necessária
- **Coluna `pecas_concluidas` preservada** — pode ser reativada no futuro se necessário
- **Informação automática** — atualiza sozinha quando o lote avança de etapa
- **Mais limpo** — remove lógica de edição inline desnecessária dos cards
