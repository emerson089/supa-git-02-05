

## Enviar PDF do pedido junto com o resumo no WhatsApp + nova mensagem

### Como vai funcionar (visão do cliente)
Ao clicar **Criar Pedido** com WhatsApp ligado, o cliente recebe **uma única mensagem no WhatsApp**: o **PDF do pedido anexado** com a seguinte legenda:

```
Olá, {Cliente}! Pedido confirmado! 🎉

Após o pagamento, envie o comprovante aqui que a gente já separa o seu pedido.

💰 *Total: R$ 1.389,93*

PIX (CNPJ):
40.548.049/0001-06

Favorecido: Delookii Confecções Ltda
```

CNPJ em linha isolada → WhatsApp permite copiar com 1 toque.

### Mudanças técnicas

**1. Novo util `src/utils/generatePedidoPDF.ts`**
- Move a função `generatePDF` que hoje está em `PedidosCriados.tsx`
- Recebe `pedido` + `estoqueItens`, retorna `{ blob, fileName, save() }`
- `PedidosCriados.tsx` é refatorado para usar o util (botão "Gerar PDF" continua igual)

**2. Novo bucket privado `pedidos-pdfs`** (migration)
- Bucket privado
- Policies em `storage.objects`: usuário autenticado só pode INSERT/SELECT/DELETE em paths que começam com `{auth.uid()}/`
- Path padronizado: `{user_id}/{pedido_id}.pdf`

**3. `src/pages/NovoPedido.tsx` — após `addPedido` ter sucesso**
- Se `enviarWhatsApp && telefone`:
  1. Gerar PDF (Blob) do `pedidoCriado` usando o util
  2. Upload pra `pedidos-pdfs/{user_id}/{pedido_id}.pdf` (upsert true)
  3. Criar **signed URL** com validade de 7 dias
  4. Montar a nova mensagem (formato acima, com `cliente`, `valorTotal` e CNPJ em linha isolada)
  5. Chamar `supabase.functions.invoke('send-whatsapp', { body: { type: 'document', phone, documentUrl, fileName: 'Pedido-{Cliente}.pdf', caption: mensagem } })`
- **Fallback**: se upload ou envio do PDF falhar, envia só o texto (mesma mensagem, sem PDF) e mostra toast `"PDF não enviado, mas resumo foi entregue"`
- A mensagem **gerencial para administradores** continua igual à atual (sem PDF)

**4. Nada muda em**
- `send-whatsapp/index.ts` (já suporta `type: 'document'`)
- Outros fluxos de WhatsApp (catálogo, transmissão em massa, notificação Separado/No Carro, comprovantes) — todos intactos
- Banco de dados (sem novas colunas em `pedidos`)
- UI (nenhum botão novo)

### Como validar
Criar um pedido de teste com seu próprio número e WhatsApp ligado → você recebe **um PDF anexado** com a legenda no formato novo, e o CNPJ numa linha sozinha pronto pra copiar com 1 toque.

