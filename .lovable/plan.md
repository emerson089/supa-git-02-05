

## Simplificar mensagem WhatsApp do pedido

### O que será feito

Remover o bloco do link InfinitePay e simplificar a mensagem WhatsApp para o formato exato solicitado, sem formatação bold do WhatsApp (asteriscos) nos campos de PIX.

### Alteração

**Arquivo:** `src/pages/NovoPedido.tsx` (linhas 312-352)

Remover toda a lógica de geração do link InfinitePay (linhas 312-340) e substituir o template da mensagem pelo texto exato:

```
Olá, {nome}! Pedido confirmado! 🎉

💰 Total: R$ {valor}

PIX (CNPJ): 40.548.049/0001-06
Favorecido: Delookii Confecções Ltda

Após o pagamento, envie o comprovante aqui que a gente já separa o seu pedido.

Qualquer dúvida é só chamar! 😊
```

O trecho de código ficará:

```typescript
const clienteNome = cliente?.nome?.split(' ')[0] || 'Cliente';
const valorFormatado = valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const mensagem = `Olá, ${clienteNome}! Pedido confirmado! 🎉

💰 Total: ${valorFormatado}

PIX (CNPJ): 40.548.049/0001-06
Favorecido: Delookii Confecções Ltda

Após o pagamento, envie o comprovante aqui que a gente já separa o seu pedido.

Qualquer dúvida é só chamar! 😊`;
```

### Resumo

| Ação | Detalhe |
|------|---------|
| Remover | Chamada `create-infinitepay-link` e lógica do `blocoLink` |
| Substituir | Template da mensagem pelo texto simplificado |

