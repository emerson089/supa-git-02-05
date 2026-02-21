

## Ajustar exibição de datas no gráfico "Tendência de Vendas"

Apenas os textos visíveis ao usuário serão alterados. Nenhuma lógica, query ou cálculo será modificado.

### O que muda

| Local | Antes | Depois |
|---|---|---|
| Eixo X do gráfico | `Sem 50/25` | `16–22 dez` |
| Tooltip (hover) | `Semana 50 de 2025` | `Semana de 16 a 22 de dezembro de 2025` |

### Alterações técnicas

**Arquivo**: `src/hooks/useDashboardData.ts`

Apenas 2 trechos dentro do bloco `case "semana"` serão ajustados:

1. **Linha ~610 (label do eixo X)**: Usar `startOfWeek` e `endOfWeek` para calcular o intervalo real e formatar como `"16–22 dez"`. Se a semana cruzar meses, mostra ambos (ex: `"28 jan–3 fev"`).

2. **Linha ~633 (tooltip)**: Formatar como `"Semana de 16 a 22 de dezembro de 2025"`. Se cruzar meses: `"Semana de 28 de janeiro a 3 de fevereiro de 2025"`.

Funções `startOfWeek`, `endOfWeek` e `format` do `date-fns` (já importado no arquivo) serão utilizadas. A semana ISO (`getWeek`) continua sendo usada internamente como chave de agrupamento — apenas o texto de exibição muda.
