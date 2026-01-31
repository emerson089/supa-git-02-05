

## Plano: Padronizar Tipografia do ResumoCard

### Objetivo

Criar hierarquia tipográfica consistente para todos os cards de métricas do resumo do pedido, sem alterar lógica de cálculos.

---

### Especificações Tipográficas

| Elemento | Tamanho | Peso | Outras |
|----------|---------|------|--------|
| Label (título) | 12px (`text-xs`) | 500 (`font-medium`) | Uppercase, opacidade 70% |
| Valor principal | 24px (`text-2xl`) | 600 (`font-semibold`) | line-height 1.2 |
| Sufixo (peças, modelos) | 14px (`text-sm`) | 400 (`font-normal`) | Mesma linha que valor |

---

### Alterações no Arquivo

**Arquivo:** `src/components/pedidos/ResumoCard.tsx`

#### Problema Atual

```tsx
// Quantidade de peças - usa text-2xl lg:text-3xl font-bold
<p className="text-2xl lg:text-3xl font-bold text-primary">
  {totalPecas} <span className="text-sm font-normal">peças</span>
</p>

// Subtotal - usa text-xl lg:text-2xl font-semibold  
<p className="text-xl lg:text-2xl font-semibold text-foreground">
  {formatCurrency(valorItens)}
</p>

// Valor total - usa text-2xl lg:text-3xl font-bold
<p className="text-2xl lg:text-3xl font-bold text-emerald-600">
  {formatCurrency(valorTotal)}
</p>
```

#### Solução: Padronizar Todos

```tsx
// LABELS - padrão para todos (12px, medium, uppercase, 70% opacity)
className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-1"

// VALORES - padrão para todos (24px, semibold, leading-tight)
className="text-2xl font-semibold leading-tight text-[COR]"

// SUFIXOS - padrão para todos (14px, normal)
className="text-sm font-normal text-muted-foreground"
```

---

### Código Final de Cada Métrica

#### 1. Quantidade total de peças

```tsx
<div className="flex flex-col gap-1">
  <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
    Quantidade total de peças
  </p>
  <p className="text-2xl font-semibold leading-tight text-primary">
    {totalPecas} <span className="text-sm font-normal text-muted-foreground">peças</span>
  </p>
</div>
```

#### 2. Quantidade de modelos

```tsx
<div className="flex flex-col gap-1">
  <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
    Quantidade de modelos
  </p>
  <p className="text-2xl font-semibold leading-tight text-violet-600">
    {quantidadeModelos} <span className="text-sm font-normal text-muted-foreground">
      {quantidadeModelos === 1 ? 'modelo' : 'modelos'}
    </span>
  </p>
</div>
```

#### 3. Subtotal dos itens

```tsx
<div className="flex flex-col gap-1">
  <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
    Subtotal dos itens
  </p>
  <p className="text-2xl font-semibold leading-tight text-foreground">
    {formatCurrency(valorItens)}
  </p>
</div>
```

#### 4. Taxa Excursão

```tsx
<div className="flex flex-col gap-1">
  <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
    Taxa Excursão {nomeExcursao && <span className="normal-case">({nomeExcursao})</span>}
  </p>
  <p className="text-2xl font-semibold leading-tight text-amber-600">
    + {formatCurrency(taxaExcursao)}
  </p>
</div>
```

#### 5. Valor total do pedido

```tsx
<div className="flex flex-col gap-1">
  <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
    Valor total do pedido
  </p>
  <p className="text-2xl font-semibold leading-tight text-emerald-600">
    {formatCurrency(valorTotal)}
  </p>
</div>
```

---

### Resumo das Mudanças

| Antes | Depois |
|-------|--------|
| Labels com `mb-2` | Labels com `gap-1` via flex container |
| Valores variando entre `text-xl`, `text-2xl`, `text-3xl` | Todos com `text-2xl` fixo |
| Pesos variando entre `font-semibold` e `font-bold` | Todos com `font-semibold` |
| Sem `leading-tight` | Todos com `leading-tight` para line-height 1.2 |

---

### Resultado Visual

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  QUANTIDADE TOTAL     QUANTIDADE DE      SUBTOTAL DOS     TAXA EXCURSÃO    │
│  DE PEÇAS             MODELOS            ITENS            (cabanas)        │
│                                                                             │
│  39 peças             2 modelos          R$ 1.080,00      + R$ 10,00       │
│  ↑ azul               ↑ roxo             ↑ neutro         ↑ amarelo        │
│                                                                             │
│                       VALOR TOTAL DO PEDIDO                                 │
│                       R$ 1.090,00                                           │
│                       ↑ verde                                               │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                              [Limpar]  [Criar Pedido]      │
└─────────────────────────────────────────────────────────────────────────────┘
```

Todos os valores agora têm o mesmo tamanho (24px) e peso (600), criando consistência visual.

---

### Arquivos Impactados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/pedidos/ResumoCard.tsx` | Padronizar classes CSS de tipografia |

