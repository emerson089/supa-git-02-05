

## Plano: Reorganizar Layout da Pagina Novo Pedido

### Objetivo

Trocar a posicao do card de Resumo para ficar acima do card de Itens do Pedido, e melhorar o layout do Resumo para que as informacoes fiquem bem alinhadas lado a lado em uma unica linha.

---

### Alteracoes Necessarias

#### 1. Arquivo: `src/pages/NovoPedido.tsx`

**Inverter a ordem dos componentes:**

Atual (linhas 347-351):
```tsx
{/* Items Card */}
<ItensPedidoCard ... />

{/* Resumo Card */}
<ResumoCard ... />
```

Novo:
```tsx
{/* Resumo Card - agora acima dos itens */}
<ResumoCard ... />

{/* Items Card - agora abaixo do resumo */}
<ItensPedidoCard ... />
```

---

#### 2. Arquivo: `src/components/pedidos/ResumoCard.tsx`

**Reorganizar layout usando CSS Grid para melhor alinhamento:**

Estrutura atual (flex com wrap):
```
[Qtd Pecas] [Qtd Modelos] [Subtotal] [Taxa] [Total]
                    (pode quebrar linha em telas menores)
```

Nova estrutura (grid organizado):
```
┌────────────────────────────────────────────────────────────────────────────┐
│  QTD TOTAL     QTD MODELOS    SUBTOTAL       TAXA           VALOR TOTAL   │
│  DE PECAS                     DOS ITENS      EXCURSAO       DO PEDIDO     │
│                                                                            │
│  26 pecas      2 modelos      R$ 720,00      + R$ 10,00     R$ 730,00    │
│                                                                            │
│                                              [Limpar]  [Criar Pedido]     │
└────────────────────────────────────────────────────────────────────────────┘
```

Mudancas no componente:

1. Usar `grid grid-cols-5` em desktop para alinhar todas as 5 metricas lado a lado
2. Em mobile usar `grid grid-cols-2` para adaptar
3. Botoes ficam abaixo das metricas, alinhados a direita
4. Quando nao tiver taxa de excursao, ajustar grid para 4 colunas

---

### Codigo do Novo Layout

```tsx
<div className="neu-card p-7">
  {/* Metricas em grid */}
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 lg:gap-8 mb-6">
    {/* Quantidade total de pecas */}
    <div>
      <p className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-2">
        Quantidade total de pecas
      </p>
      <p className="text-2xl lg:text-3xl font-bold text-primary">
        {totalPecas} <span className="text-sm font-normal text-muted-foreground">pecas</span>
      </p>
    </div>
    
    {/* Quantidade de modelos */}
    <div>
      <p className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-2">
        Quantidade de modelos
      </p>
      <p className="text-2xl lg:text-3xl font-bold text-violet-600">
        {quantidadeModelos} <span className="text-sm font-normal text-muted-foreground">
          {quantidadeModelos === 1 ? 'modelo' : 'modelos'}
        </span>
      </p>
    </div>
    
    {/* Subtotal dos itens */}
    <div>
      <p className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-2">
        Subtotal dos itens
      </p>
      <p className="text-xl lg:text-2xl font-semibold text-foreground">
        {formatCurrency(valorItens)}
      </p>
    </div>
    
    {/* Taxa Excursao - condicional */}
    {taxaExcursao > 0 && (
      <div>
        <p className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-2">
          Taxa Excursao {nomeExcursao && <span className="normal-case">({nomeExcursao})</span>}
        </p>
        <p className="text-xl lg:text-2xl font-semibold text-amber-600">
          + {formatCurrency(taxaExcursao)}
        </p>
      </div>
    )}
    
    {/* Valor total do pedido */}
    <div>
      <p className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-2">
        Valor total do pedido
      </p>
      <p className="text-2xl lg:text-3xl font-bold text-emerald-600">
        {formatCurrency(valorTotal)}
      </p>
    </div>
  </div>
  
  {/* Botoes alinhados a direita */}
  <div className="flex items-center justify-end gap-4 pt-4 border-t border-border/30">
    <Button variant="outline" onClick={onLimpar}>
      Limpar Formulario
    </Button>
    <Button onClick={onCriarPedido} disabled={isLoading || disabled}>
      {isLoading ? 'Criando...' : disabled ? 'Estoque Insuficiente' : 'Criar Pedido'}
    </Button>
  </div>
</div>
```

---

### Resultado Visual Esperado

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Cliente Info Card                                                           │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  Cliente Insights Card                                                       │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  RESUMO (agora acima)                                                        │
│                                                                              │
│  QTD PECAS    QTD MODELOS    SUBTOTAL        TAXA           VALOR TOTAL    │
│  26 pecas     2 modelos      R$ 720,00       + R$ 10,00     R$ 730,00      │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                              [Limpar]  [Criar Pedido]       │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  ITENS DO PEDIDO (agora abaixo)                               [+ Adicionar] │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Short alfa. botoes todas cores - 170    12    R$ 30    R$ 360,00  [X] │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Short cinto encapado - 160              12    R$ 30    R$ 360,00  [X] │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### Resumo de Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/NovoPedido.tsx` | Inverter ordem: ResumoCard antes de ItensPedidoCard |
| `src/components/pedidos/ResumoCard.tsx` | Reorganizar layout com grid para melhor alinhamento |

