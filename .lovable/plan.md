

## Plano: Adicionar Indicador de Quantidade de Modelos

### Objetivo

Exibir no card de resumo do pedido a quantidade de modelos diferentes selecionados, por exemplo: **"Quantidade de modelos: 2"**

---

### Alteracao Necessaria

**Arquivo:** `src/components/pedidos/ResumoCard.tsx`

#### 1. Adicionar nova prop

```typescript
interface ResumoCardProps {
  totalPecas: number;
  valorItens: number;
  taxaExcursao: number;
  nomeExcursao?: string;
  valorTotal: number;
  quantidadeModelos: number;  // <-- NOVA PROP
  onLimpar: () => void;
  onCriarPedido: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}
```

#### 2. Adicionar indicador visual no card

Inserir entre "Quantidade total de pecas" e "Subtotal dos itens":

```tsx
<div>
  <p className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-2">
    Quantidade de modelos
  </p>
  <p className="text-3xl font-bold text-violet-600">
    {quantidadeModelos} <span className="text-base font-normal text-muted-foreground">
      {quantidadeModelos === 1 ? 'modelo' : 'modelos'}
    </span>
  </p>
</div>
```

---

**Arquivo:** `src/pages/NovoPedido.tsx`

#### 3. Calcular quantidade de modelos

Adicionar calculo que conta itens com `produtoId` preenchido:

```typescript
const quantidadeModelos = useMemo(() => {
  const modelosUnicos = new Set(
    items
      .filter(item => item.produtoId) // apenas itens com produto selecionado
      .map(item => item.produtoId)
  );
  return modelosUnicos.size;
}, [items]);
```

#### 4. Passar para o componente

```tsx
<ResumoCard
  totalPecas={totalPecas}
  valorItens={valorItens}
  taxaExcursao={taxaExcursao}
  nomeExcursao={excursaoNome}
  valorTotal={valorTotal}
  quantidadeModelos={quantidadeModelos}  // <-- NOVA PROP
  onLimpar={handleLimpar}
  onCriarPedido={handleCriarPedido}
  isLoading={isCreating}
  disabled={hasEstoqueInsuficiente}
/>
```

---

### Resultado Visual

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  QUANTIDADE TOTAL    QUANTIDADE DE      SUBTOTAL DOS    TAXA EXCURSAO       │
│  DE PECAS            MODELOS            ITENS           (cabanas turismo)   │
│                                                                              │
│  24 pecas            2 modelos          R$ 720,00       + R$ 10,00          │
│                                                                              │
│                                         VALOR TOTAL DO PEDIDO               │
│                                         R$ 730,00                           │
│                                                                              │
│                                    [Limpar Formulario] [Criar Pedido]       │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### Resumo de Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/pedidos/ResumoCard.tsx` | Adicionar prop `quantidadeModelos` e exibir no card |
| `src/pages/NovoPedido.tsx` | Calcular e passar `quantidadeModelos` para o componente |

