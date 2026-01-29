

## ✅ Plano: Adicionar Título às Cargas de Feira

**Status: Implementado**

### Objetivo
Permitir que o usuário defina um título/nome para cada carga (ex: "Alfaiataria", "Jeans") para facilitar a identificação no histórico e nas cargas em andamento.

### Implementação Realizada

1. **NovaCargaStepProdutos.tsx**: Campo de título adicionado antes da busca
2. **NovaCargaBottomSheet.tsx**: Título exibido no header do carrinho
3. **Feira.tsx**: Estado `tituloCarga` + passagem para criação via `observacoes`
4. **CargasAtivasAlerta.tsx**: Título exibido nas cargas em andamento
5. **HistoricoAgrupado.tsx**: Título exibido nas linhas de cargas
6. **DetalhesCargaModal.tsx**: Título no cabeçalho do modal

### Sem Alterações no Banco de Dados
O campo `observacoes` (text, nullable) já existente na tabela `transferencias` foi reutilizado como título.

