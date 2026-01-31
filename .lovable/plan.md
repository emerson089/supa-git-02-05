

## Plano: Melhorar UX do Gráfico de Tendência de Vendas

### Problema Atual

1. O eixo X mostra apenas "mai/25, jun/25..." sem clareza quando atravessa anos
2. Não há indicação explícita do período completo acima do gráfico
3. Faltam presets rápidos de período (30 dias, 90 dias, etc.)
4. Quando o intervalo cruza anos diferentes, não fica claro visualmente

### Solucao

#### 1. Exibir Periodo Completo Acima do Grafico

**Arquivo:** `src/pages/Dashboard.tsx` (linhas 616-622)

Adicionar um texto explicito acima do grafico mostrando:
```
Periodo: 01/04/2025 → 31/01/2026
```

**De:**
```tsx
<CardHeader className="pb-2">
  <CardTitle className="text-base font-semibold">Tendência de Vendas</CardTitle>
  <p className="text-sm text-muted-foreground">
    Receita {tipoAgrupamento} no período
  </p>
</CardHeader>
```

**Para:**
```tsx
<CardHeader className="pb-2">
  <CardTitle className="text-base font-semibold">Tendência de Vendas</CardTitle>
  <div className="flex items-center gap-2 flex-wrap">
    <p className="text-sm text-muted-foreground">
      Receita {tipoAgrupamento} no período
    </p>
    <Badge variant="outline" className="text-xs font-normal">
      Período: {formatPeriodoExplicito()}
    </Badge>
    {periodoAcrossaAnos && (
      <Badge variant="secondary" className="text-xs">
        ⚠️ Cruza anos
      </Badge>
    )}
  </div>
</CardHeader>
```

---

#### 2. Melhorar Formato do Eixo X

**Arquivo:** `src/hooks/useDashboardData.ts` (linhas 558-567)

Alterar a formatacao da chave para incluir ano de forma mais clara:

**De:**
```typescript
case "mes":
  chave = format(dataCompleta, "MMM/yy", { locale: ptBR });
  break;
default:
  chave = format(dataCompleta, "dd/MM");
```

**Para:**
```typescript
case "mes":
  // Manter formato curto mas com ano: jan/25, fev/26
  chave = format(dataCompleta, "MMM/yy", { locale: ptBR });
  break;
default:
  // Para dias, incluir ano quando necessário
  chave = format(dataCompleta, "dd/MM/yy");
```

---

#### 3. Adicionar Presets Rapidos de Periodo

**Arquivo:** `src/pages/Dashboard.tsx`

Expandir os presets de periodo (atualmente: Hoje, 7 dias, Mes) para incluir:

| Preset Atual | Novos Presets |
|--------------|---------------|
| Hoje | Hoje |
| 7 dias | Ultimos 30 dias |
| Mes | Ultimos 90 dias |
| Personalizado | Ano atual |
| - | Ultimos 12 meses |

**Alterar o tipo `Periodo`:**

```typescript
// De:
type Periodo = "hoje" | "7dias" | "mes" | "personalizado";

// Para:
type Periodo = "hoje" | "30dias" | "90dias" | "ano_atual" | "12meses" | "personalizado";
```

**Alterar `getDateRange` em `useDashboardData.ts`:**

```typescript
case "30dias":
  startDate = startOfDay(subDays(now, 30));
  break;
case "90dias":
  startDate = startOfDay(subDays(now, 90));
  break;
case "ano_atual":
  startDate = startOfYear(now);
  break;
case "12meses":
  startDate = startOfDay(subMonths(now, 12));
  break;
```

---

#### 4. Indicar Visualmente Quando Cruza Anos

**Arquivo:** `src/pages/Dashboard.tsx`

Adicionar funcao para detectar se o periodo cruza anos:

```typescript
const periodoAcrossaAnos = useMemo(() => {
  if (data.tendenciaVendas.length < 2) return false;
  const primeiro = data.tendenciaVendas[0].dataOriginal;
  const ultimo = data.tendenciaVendas[data.tendenciaVendas.length - 1].dataOriginal;
  return getYear(primeiro) !== getYear(ultimo);
}, [data.tendenciaVendas]);
```

Exibir badge de aviso quando cruzar anos:
```tsx
{periodoAcrossaAnos && (
  <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
    📅 Período cruza {getYear(primeiro)} → {getYear(ultimo)}
  </Badge>
)}
```

---

#### 5. Melhorar Botao de Calendario

**Arquivo:** `src/pages/Dashboard.tsx` (linhas 386-398)

Alterar o botao de calendario para mostrar o ano quando o periodo cruza anos:

**De:**
```tsx
{format(dateRange.from, "dd/MM")} - {format(dateRange.to, "dd/MM")}
```

**Para:**
```tsx
// Se mesmo ano, formato curto
// Se anos diferentes, mostrar ano completo
{getYear(from) === getYear(to) 
  ? `${format(from, "dd/MM")} - ${format(to, "dd/MM")}`
  : `${format(from, "dd/MM/yyyy")} - ${format(to, "dd/MM/yyyy")}`
}
```

---

### Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useDashboardData.ts` | Atualizar tipo `Periodo`, adicionar novos cases em `getDateRange` |
| `src/pages/Dashboard.tsx` | Adicionar presets de periodo, exibir periodo explicito no grafico, detectar cruzamento de anos |

---

### Resultado Esperado

1. **Eixo X claro**: "mai/25, jun/25, jan/26" - sempre com ano visivel
2. **Periodo explicito**: Badge acima do grafico: "Periodo: 01/04/2025 → 31/01/2026"
3. **Presets rapidos**: Botoes para 30d, 90d, Ano atual, 12 meses
4. **Aviso visual**: Badge amarelo quando o periodo cruza anos diferentes
5. **Calendario melhorado**: Mostra ano completo quando necessario

---

### Notas Tecnicas

- Nenhuma alteracao na logica de calculo
- Apenas mudancas de apresentacao e filtros
- Compativel com mobile e desktop
- Persistencia de filtros no localStorage mantida

