

## Plano: Devolver Peças ao Estoque ao Excluir Pedido

### Problema Identificado

Atualmente, ao excluir um pedido criado:
- A função `handleDelete` simplesmente remove o pedido do banco
- Os itens são deletados via CASCADE
- **As quantidades NÃO são devolvidas ao estoque**

Isso causa uma perda de rastreabilidade do estoque, pois as peças que estavam "vendidas" desaparecem sem voltar ao inventário.

---

### Solução Proposta

Modificar o fluxo de exclusão para:
1. Buscar o pedido completo com seus itens **antes** de excluir
2. Para cada item, localizar o produto no estoque e adicionar a quantidade de volta
3. Registrar movimentação de estorno (opcional, para auditoria)
4. Então excluir o pedido

---

### Alterações Técnicas

#### 1. Arquivo: `src/pages/PedidosCriados.tsx`

**Modificar a função `handleDelete` (linhas 392-398):**

```typescript
// ANTES
const handleDelete = () => {
  if (deleteId) {
    removePedido(deleteId);
    setDeleteId(null);
    toast.success('Pedido excluído com sucesso!');
  }
};

// DEPOIS
const handleDelete = async () => {
  if (!deleteId) return;
  
  try {
    // Buscar o pedido completo com itens
    const pedido = getPedidoById(deleteId);
    
    // Se encontrou o pedido e não foi estornado ainda, devolver ao estoque
    if (pedido && !pedido.estornoRealizado) {
      const pecasDevolvidas = estornarEstoque(pedido);
      
      if (pecasDevolvidas > 0) {
        // Aguardar um tick para garantir que as atualizações de estoque foram processadas
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Excluir o pedido
    removePedido(deleteId);
    setDeleteId(null);
    
    const mensagem = pedido && !pedido.estornoRealizado && pedido.totalPecas > 0
      ? `Pedido excluído! ${pedido.totalPecas} peças retornaram ao estoque.`
      : 'Pedido excluído com sucesso!';
    
    toast.success(mensagem);
  } catch (error) {
    console.error('Erro ao excluir pedido:', error);
    toast.error('Erro ao excluir pedido');
    setDeleteId(null);
  }
};
```

#### 2. Tratamento de Casos Especiais

A lógica considera:

| Cenário | Comportamento |
|---------|---------------|
| Pedido ativo (não cancelado) | Devolve todas as peças ao estoque |
| Pedido já cancelado (`estornoRealizado = true`) | Não devolve (já foi estornado antes) |
| Pedido sem itens | Apenas exclui, sem devolução |
| Item sem `produtoId` | Tenta encontrar pelo nome no estoque |
| Produto não encontrado no estoque | Ignora (log de warning) |

---

### Fluxo de Exclusão Atualizado

```text
Usuário clica "Excluir"
       │
       ▼
┌──────────────────────────┐
│  Buscar pedido completo  │
└──────────────────────────┘
       │
       ▼
┌──────────────────────────┐
│  Pedido já foi estornado?│
└──────────────────────────┘
       │
   Não │        Sim
       ▼         ▼
┌──────────────┐  │
│ Para cada    │  │
│ item:        │  │
│ - Encontrar  │  │
│   produto    │  │
│ - Somar qty  │  │
│   ao estoque │  │
└──────────────┘  │
       │          │
       ▼          │
┌──────────────────────────┐
│  Excluir pedido (CASCADE)│
└──────────────────────────┘
       │
       ▼
┌──────────────────────────┐
│  Toast: "X peças voltaram│
│  ao estoque"             │
└──────────────────────────┘
```

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/PedidosCriados.tsx` | Modificar `handleDelete` para devolver estoque antes de excluir |

---

### Comportamento Esperado Após Implementação

1. Ao excluir um pedido **não cancelado**:
   - As quantidades de cada item voltam ao estoque
   - Mensagem: "Pedido excluído! X peças retornaram ao estoque."

2. Ao excluir um pedido **já cancelado** (estorno já realizado):
   - Não há devolução duplicada
   - Mensagem: "Pedido excluído com sucesso!"

3. Ao excluir um pedido **sem itens**:
   - Apenas exclui
   - Mensagem: "Pedido excluído com sucesso!"

---

### Considerações de Segurança

- A função `estornarEstoque` já existe e é usada no cancelamento
- Reutilizamos essa função para evitar duplicação de código
- O campo `estornoRealizado` impede devolução duplicada

