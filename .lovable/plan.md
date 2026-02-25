

## Correcoes no Historico de Producao

### Problemas identificados

1. **Labels inconsistentes no resumo "Responsaveis por Etapa"**: Algumas etapas mostram o nome correto (ex: "Lavanderia: Kaysu lavanderia", "Faccao / Costureira: Regina") mas outras mostram apenas "Responsavel: edjan" ou "Responsavel: Ivan" sem indicar qual etapa. Isso acontece porque as etapas Travete, Destroyed, Limpado e Aprontamento usam o label generico "Responsavel" no mapa STAGE_LABELS.

2. **Cortador nao aparece no resumo**: O Corte e a primeira etapa -- o lote ja nasce nela, sem passar pelo modal de transicao. Por isso, nao existe um log com `processo_novo = 'Corte'`, e o cortador nunca entra no mapa `responsaveisPorEtapa`. Solucao: usar o campo `responsavel` do proprio lote como fallback para a etapa Corte.

3. **"Agora nesta etapa" para todas as entradas**: Quando varias transicoes sao feitas em sequencia rapida (minutos), o calculo usa `differenceInDays` e `differenceInHours`, ambos retornam 0, resultando em "Agora" para todas. Solucao: adicionar `differenceInMinutes` para mostrar "X min" quando o tempo e inferior a 1 hora.

---

### Alteracoes

#### 1. HistoricoProducaoModal.tsx -- Padronizar labels no resumo

Trocar o mapa `STAGE_LABELS` para usar o **nome da etapa** em todos os casos, ao inves de "Responsavel" generico:

```text
Corte       -> Cortador
Costura/Faccao -> Faccao / Costureira
Travete     -> Travete
Destroyed   -> Destroyed
Lavanderia  -> Lavanderia
Limpado     -> Limpado
Aprontamento -> Aprontamento
Vendas      -> Vendas
```

Resultado: "Travete: Ivan" em vez de "Responsavel: Ivan"

#### 2. useProducaoLog.ts -- Incluir cortador no mapa de responsaveis

Receber o campo `responsavel` do lote como parametro opcional. Se nao houver entrada para 'Corte' em `responsaveisPorEtapa` e o lote tiver um `responsavel` definido, usar esse valor como fallback.

Assinatura atualizada:
```text
useProducaoLogsComTempo(producaoId, dataCriacao, responsavelLote?)
```

#### 3. useProducaoLog.ts -- Corrigir calculo de tempo para transicoes rapidas

Atualizar `formatTempo` para usar `differenceInMinutes` quando dias e horas sao 0:

```text
Se dias=0 e horas=0:
  - Calcular minutos
  - Se minutos > 0: mostrar "X min"
  - Se minutos = 0: mostrar "Agora"
```

Tambem atualizar a interface `LogComTempoNaEtapa` para incluir `minutos` no calculo.

#### 4. HistoricoProducaoModal.tsx -- Passar responsavel do lote ao hook

Atualizar a chamada do hook para enviar `lot?.responsavel` como terceiro parametro.

---

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useProducaoLog.ts` | Receber responsavel do lote; adicionar minutos ao calculo de tempo; corrigir formatTempo |
| `src/components/production/HistoricoProducaoModal.tsx` | Padronizar STAGE_LABELS com nome da etapa; passar lot.responsavel ao hook |

### Impacto no backend
- Zero alteracoes no banco de dados
