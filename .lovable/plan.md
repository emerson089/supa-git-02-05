

## Correção de Persistência do DatePicker + Feriados Brasileiros

### A) BUG -- Persistência do filtro de datas

**Problema**: Ao reabrir o DatePicker, ele reseta para o mês atual mesmo quando um range personalizado está selecionado.

**Causa**: O componente `Calendar` não recebe `defaultMonth`, então sempre abre no mês atual.

**Solução** (arquivo `src/pages/Dashboard.tsx`):

1. Adicionar a prop `defaultMonth={dateRange.from}` nos dois `<Calendar mode="range">` (mobile na linha ~452 e desktop na linha ~504). Isso faz o calendário abrir no mês do range selecionado.
2. O `selected={dateRange}` já está correto e mantém o range visualmente marcado.
3. O reset continua ocorrendo apenas via "Limpar filtros" ou seleção de preset (já implementado em `handleClearFilters` e `handlePeriodoClick`).

Nenhuma outra lógica é alterada.

---

### B) FEATURE -- Feriados brasileiros no DatePicker

**Arquitetura**:

```text
Edge Function (backend)          Frontend
+---------------------------+    +-------------------------+
| GET /brazilian-holidays   |    | useHolidays() hook      |
| - Gera feriados fixos     |--->| - Consome JSON          |
| - Calcula móveis          |    | - Mapeia por data       |
|   (Páscoa, Carnaval, etc) |    +-------------------------+
| - Cache 7 dias            |            |
| - Retorna JSON            |    +-------v-----------------+
+---------------------------+    | Calendar com modifiers   |
                                 | - Dot visual em feriados |
                                 | - Tooltip com nome       |
                                 +-------------------------+
```

**Arquivos novos**:

| Arquivo | Responsabilidade |
|---|---|
| `supabase/functions/brazilian-holidays/index.ts` | Edge function que calcula feriados nacionais fixos + móveis (Carnaval, Corpus Christi, Sexta-feira Santa) para o ano solicitado. Retorna JSON com `{ date, title, type }`. Cache de 7 dias via header. |
| `src/hooks/useHolidays.ts` | Hook React Query que consome a edge function. Recebe ano(s) e retorna `Map<string, Holiday[]>` indexado por data ISO (YYYY-MM-DD). staleTime de 24h. |

**Arquivo modificado**:

| Arquivo | Alteracao |
|---|---|
| `src/pages/Dashboard.tsx` | Importar hook, passar dados para Calendar via `modifiers` e `modifiersStyles` do react-day-picker. Adicionar tooltip ao hover sobre dias com feriado. |
| `src/components/ui/calendar.tsx` | Adicionar suporte a `modifiers` e `modifiersStyles` passados via props (já suportado pelo DayPicker, apenas garantir repasse). |

**Edge Function -- Logica de feriados**:

Feriados fixos nacionais:
- 1 jan (Confraternização Universal), 21 abr (Tiradentes), 1 mai (Dia do Trabalho), 7 set (Independência), 12 out (N.S. Aparecida), 2 nov (Finados), 15 nov (Proclamação da República), 25 dez (Natal)

Feriados móveis (calculados a partir da Páscoa via algoritmo de Gauss):
- Carnaval (Páscoa - 47 dias), Sexta-feira Santa (Páscoa - 2), Corpus Christi (Páscoa + 60)

Tipo: `national` para feriados nacionais, `observance` para Carnaval e outros eventos complementares.

**Visual no calendário**:
- Pequeno dot colorido abaixo do número do dia
- Não interfere na seleção de range (é apenas decorativo via `modifiers`)
- Tooltip ao hover mostra nome do feriado

---

### C) Eventos complementares configuráveis

A edge function aceitará um parâmetro opcional `include_observances=true` (default true) que inclui eventos como Carnaval. Esses eventos terão `type: "observance"` e visual diferenciado (dot em cor mais suave). Nenhuma lógica especial que afete filtros ou métricas.

---

### Criterios de aceite garantidos

- Presets continuam limpando o dateRange como hoje
- Range selection continua funcionando (modifiers são decorativos)
- Performance: hook com staleTime longo + edge function com cache header
- Nenhuma query de dados ou calculo de KPI alterado
