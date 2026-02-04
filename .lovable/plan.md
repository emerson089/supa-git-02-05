
## Plano: Melhorias no Calendário de Seleção de Datas

### Problemas Identificados

1. **Nome do mês em inglês**: O calendário está mostrando "February 2026" em vez de "Fevereiro 2026"
2. **Calendário não abre no mês correto**: Quando uma data já está selecionada, o calendário deveria abrir mostrando o mês/ano dessa data, não o mês atual
3. **Experiência de seleção**: A navegação entre meses pode ser melhorada

---

### Solução Proposta

#### 1. Adicionar Locale Português (ptBR)

O projeto já usa `date-fns/locale` com `ptBR` em outros lugares (Dashboard, FiltroPeriodo, FiltrosTransferencias). Falta apenas adicionar nas páginas de Pedidos.

**Mudanças necessárias:**
- Adicionar `locale={ptBR}` ao componente Calendar
- Isso traduz automaticamente:
  - Nomes dos meses: "February" → "Fevereiro"
  - Dias da semana: "Su, Mo, Tu..." → "Dom, Seg, Ter..."

#### 2. Usar `defaultMonth` para Abrir no Mês Correto

O componente Calendar do react-day-picker aceita a prop `defaultMonth` que define qual mês será exibido inicialmente:

```typescript
<Calendar
  mode="single"
  selected={startDate}
  onSelect={setStartDate}
  defaultMonth={startDate}  // Abre no mês da data selecionada
  locale={ptBR}
  initialFocus
/>
```

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/PedidosCriados.tsx` | Adicionar `locale={ptBR}` e `defaultMonth` aos 2 calendários (Início e Fim) |
| `src/components/pedidos/MobileFiltersSheet.tsx` | Adicionar `locale={ptBR}` e `defaultMonth` aos 2 calendários (Início e Fim) |

---

### Alterações Detalhadas

#### Arquivo: `src/pages/PedidosCriados.tsx`

**Linhas 951-966 - Calendários desktop:**

Antes:
```typescript
<Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="pointer-events-auto" />
```

Depois:
```typescript
<Calendar 
  mode="single" 
  selected={startDate} 
  onSelect={setStartDate} 
  defaultMonth={startDate}
  locale={ptBR}
  initialFocus 
  className="pointer-events-auto" 
/>
```

**Importação necessária:**
```typescript
import { ptBR } from 'date-fns/locale';
```
(Esta importação já existe na linha 34 do arquivo)

---

#### Arquivo: `src/components/pedidos/MobileFiltersSheet.tsx`

**Linhas 225-251 - Calendários mobile:**

Antes:
```typescript
<Calendar
  mode="single"
  selected={startDate}
  onSelect={onStartDateChange}
  initialFocus
  className="pointer-events-auto"
/>
```

Depois:
```typescript
<Calendar
  mode="single"
  selected={startDate}
  onSelect={onStartDateChange}
  defaultMonth={startDate}
  locale={ptBR}
  initialFocus
  className="pointer-events-auto"
/>
```

**Importação necessária:**
```typescript
import { ptBR } from 'date-fns/locale';
```

---

### Resultado Visual Esperado

**Antes:**
```
┌────────────────────────┐
│  <   February 2026   > │
│  Su Mo Tu We Th Fr Sa  │
│  1  2  3  4  5  6  7   │
└────────────────────────┘
```

**Depois:**
```
┌────────────────────────┐
│  <   Fevereiro 2026  > │
│  Dom Seg Ter Qua Qui... │
│  1   2   3   4   5...   │
└────────────────────────┘
```

---

### Comportamento de Navegação

| Cenário | Comportamento |
|---------|--------------|
| Data selecionada: 15/02/2026 | Calendário abre em Fevereiro 2026 |
| Data selecionada: 10/01/2026 | Calendário abre em Janeiro 2026 |
| Nenhuma data selecionada | Calendário abre no mês atual |

---

### Resumo das Mudanças

1. **2 arquivos modificados**
2. **1 importação adicionada** (MobileFiltersSheet.tsx)
3. **4 props adicionadas** (locale + defaultMonth em 2 lugares)
4. **Zero alterações no componente Calendar base** - apenas uso correto das props existentes
