

## Ajuste de UX -- Mascarar Valor Total por Padrao

### Resumo

Adicionar funcionalidade de mostrar/ocultar o valor financeiro em todos os locais onde "Valor Total" aparece na tela de Pedidos Criados. O valor vem mascarado por padrao e o usuario pode revelar clicando num icone de olho.

### Locais afetados

Existem **4 locais** onde o valor total e exibido na pagina:

1. **Card desktop** (linha ~834-842) -- card "Valor Total" com icone de cifrao
2. **Painel de totais filtrados** (linha ~1011-1014) -- "Valor Total Filtrado" abaixo da tabela
3. **Modal de detalhes** (linha ~1340-1348) -- "Valor Total" dentro do dialog de detalhes do pedido
4. **Cards mobile** (`MobileSummaryCards.tsx`) -- card "Valor" no grid 3 colunas

### Implementacao

**Estado local (sem persistencia)**:
- Um `useState<boolean>(false)` chamado `showValor` no componente `PedidosCriados`
- Ao recarregar ou sair da tela, volta para `false` (mascarado)

**Valor mascarado**:
- Exibir `R$ ••••••` no lugar do valor real
- Icone `Eye` (mostrar) / `EyeOff` (ocultar) clicavel ao lado do valor no card desktop
- Click no icone alterna o estado globalmente (todos os 4 locais reagem)

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/pages/PedidosCriados.tsx` | Adicionar estado `showValor`, importar `Eye`/`EyeOff` do lucide-react, aplicar mascara nos 3 locais (card desktop, painel filtrado, modal detalhes). Passar prop para MobileSummaryCards. |
| `src/components/pedidos/MobileSummaryCards.tsx` | Adicionar prop `showValor` e `onToggleValor`, aplicar mascara no card de Valor e incluir icone de toggle. |

### Detalhes tecnicos

**No PedidosCriados.tsx**:

```typescript
const [showValor, setShowValor] = useState(false);
const maskedValue = "R$ ••••••";
```

**Card desktop (linha ~834)**:
```tsx
<div className="neu-card p-5 flex items-center gap-4">
  <div className="p-3 rounded-xl bg-emerald-500/10 shadow-inner">
    <DollarSign className="h-6 w-6 text-emerald-600" />
  </div>
  <div className="flex-1">
    <p className="text-sm text-muted-foreground">Valor Total</p>
    <p className="text-2xl font-bold text-emerald-600">
      {showValor ? formatCurrency(calculatedTotals.totalValor) : maskedValue}
    </p>
  </div>
  <Button variant="ghost" size="icon" onClick={() => setShowValor(!showValor)}>
    {showValor ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
  </Button>
</div>
```

**Painel filtrado (linha ~1013)**:
```tsx
<span className="font-bold text-emerald-600">
  {showValor ? formatCurrency(calculatedTotals.totalValor) : maskedValue}
</span>
```

**Modal detalhes (linha ~1345)**:
```tsx
<p className="text-2xl font-semibold leading-tight text-emerald-600">
  {showValor ? formatCurrency(selectedPedido.valor_total || 0) : maskedValue}
</p>
```

**MobileSummaryCards**:
```tsx
// Nova prop
showValor?: boolean;
onToggleValor?: () => void;

// No card de Valor, substituir valor por mascara e adicionar icone
```

### O que NAO muda

- Nenhum calculo ou query e alterado
- Nenhum outro KPI (Pedidos, Pecas) e afetado
- Layout permanece identico (apenas conteudo textual muda)
- Performance zero impacto (e apenas um boolean local)
- PDF de exportacao continua mostrando o valor real
- Filtros, paginacao, ordenacao -- tudo inalterado

