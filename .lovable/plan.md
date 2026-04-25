## Corrigir os 4 erros de build que estão impedindo o app de compilar

São apenas correções pontuais — nenhuma mudança de comportamento, nenhuma alteração de banco de dados, nenhuma migração SQL. O objetivo é só destravar o build.

---

### 1. `src/utils/dateTz.ts` — propriedade errada do date-fns
**Erros:** linhas 92 e 97 usam `{ weekStarts: 1 }`, mas o nome correto da opção do `date-fns` é `weekStartsOn`.

**Correção:**
- Linha 92: `startOfWeek(spDate, { weekStarts: 1 })` → `startOfWeek(spDate, { weekStartsOn: 1 })`
- Linha 97: `endOfWeek(spDate, { weekStarts: 1 })` → `endOfWeek(spDate, { weekStartsOn: 1 })`

Isso mantém a semana ISO (segunda a domingo) como já estava planejado.

---

### 2. `src/components/layout/BottomNavigation.tsx` — referências a estado removido
**Erros:** linhas 140, 148, 160 e 168 chamam `setMoreMenuOpen(false)`, mas esse `useState` não existe mais no componente (só sobrou `setQuickActionsOpen`). O "More menu" foi descontinuado e essas chamadas ficaram órfãs.

**Correção:** Remover as 4 chamadas `setMoreMenuOpen(false)` — as chamadas `setQuickActionsOpen(false)` ao lado já dão conta do fechamento. Não há perda de funcionalidade, porque o menu correspondente já não existe na UI.

---

### 3. `src/hooks/useSalesTrendChart.ts` — leitura de campo interno sem cast
**Erro:** linha 195 acessa `result[daysDiff]._isPrevValid`, mas `_isPrevValid` não existe no tipo `TrendDataPoint`. O campo é empurrado no objeto com `as any` (linha 177) e depois removido no `map` final (linha 217), então é só um campo interno temporário — falta o cast na leitura.

**Correção:** Trocar `result[daysDiff]._isPrevValid` por `(result[daysDiff] as any)._isPrevValid`.

---

### 4. `src/hooks/useRecebimentosTrendChart.ts` — mesma situação do hook acima
**Erro:** linha 158 com o mesmo padrão.

**Correção:** Trocar `result[daysDiff]._isPrevValid` por `(result[daysDiff] as any)._isPrevValid`.

---

### Validação
- Build do projeto deve passar (`tsc` sem erros).
- Comportamento visual do gráfico Tendência de Vendas e Recebimentos Confirmados deve continuar idêntico.
- Bottom navigation no mobile deve continuar abrindo/fechando o menu de Ações Rápidas normalmente.
- Cálculos de semana (ISO segunda → domingo) devem funcionar corretamente após a correção do `weekStartsOn`.

### Observações
- **Nenhuma migração SQL.** Nenhuma mudança em RPCs, tabelas, RLS, edge functions ou storage.
- **Nenhuma mudança de UX.** Os 4 ajustes são puramente de tipagem / referência morta.
- O plano maior do "Tendência de Vendas — Ano/Mês/Semana" continua intacto e independente; estas correções só destravam o que já foi escrito para que o app volte a rodar.
