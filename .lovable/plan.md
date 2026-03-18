

## Plano: Melhorar layout do resumo e exibição do desconto

### O que muda

**1. ResumoCard (tela Novo Pedido)**
- Reorganizar o grid de métricas em layout horizontal com 4 colunas fixas: Total de Peças | Qtd de Modelos | Desconto (Interno) | Valor Total
- Quando houver desconto > 0, o Valor Total exibirá:
  - O valor original riscado (line-through, cinza)
  - O valor com desconto em destaque (verde, grande)
  - A economia exibida como badge: "- R$ 32,00 de desconto"
- Taxa Excursão e Subtotal ficam como linha auxiliar acima do grid principal (texto menor)

**2. Modal de detalhes (PedidosCriados)**
- Mesmo tratamento visual: quando desconto > 0, mostrar valor original riscado + valor final com desconto
- Layout em grid horizontal de 4 colunas (Total Peças, Qtd Modelos, Desconto, Valor Total)

### Arquivos alterados
- `src/components/pedidos/ResumoCard.tsx` - Refatorar grid e lógica de exibição do desconto/valor total
- `src/pages/PedidosCriados.tsx` (linhas ~1447-1506) - Atualizar seção de totais do modal de detalhes

### Comportamento do Valor Total com desconto
```text
Sem desconto:          Com desconto:
┌──────────────┐       ┌──────────────────────┐
│ VALOR TOTAL  │       │ VALOR TOTAL          │
│ R$ 1.200,00  │       │ R$ 1.200,00  (riscado)│
│              │       │ R$ 1.168,00  (verde)  │
│              │       │ -R$ 32,00 desconto    │
└──────────────┘       └──────────────────────┘
```

