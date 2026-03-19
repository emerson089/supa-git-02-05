

## Plano: Adicionar hora de criação nos pedidos

Adicionar o horário (`HH:mm`) junto à data em todos os locais onde a data de criação do pedido é exibida.

### Alterações

**1. `src/pages/PedidosCriados.tsx`**
- **Tabela desktop (linha ~1216)**: Mudar formato de `dd/MM/yyyy` para `dd/MM/yyyy HH:mm`
- **Modal de detalhes (linha ~1453)**: Mesmo ajuste no formato
- **PDF (linha ~683)**: Incluir horário no PDF gerado
- **CSV export (linha ~884)**: Incluir horário na exportação

**2. `src/components/pedidos/MobileOrderCard.tsx`**
- **Card mobile (linha ~95)**: Mudar formato para `dd/MM/yyyy HH:mm`

Todas as alterações usam a mesma lib `date-fns` já importada, apenas mudando a string de formato.

