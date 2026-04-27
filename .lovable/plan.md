## Diagnóstico

A Z-API está conectada e o webhook "Ao receber" aponta corretamente pra `webhook-comprovantes`. Mas no painel da Z-API existe uma configuração separada e obrigatória pra receber **mensagens de grupo** — ela não está visível no print atual e provavelmente está desligada.

Sintoma confirma a teoria: nos eventos brutos recebidos, só apareceram mensagens privadas. Nenhum evento do grupo `120363402446093422-group` chegou na função.

## O que vou fazer

### 1. Limpeza de duplicidade no banco

A tabela `grupos_comprovantes` está com cada grupo cadastrado 2x (problema do seed). Migration pra remover duplicatas e adicionar UNIQUE constraint em `group_whatsapp_id` pra impedir que aconteça de novo.

### 2. Edge function `zapi-config-grupos` (one-shot)

Cria uma função simples que chama o endpoint da Z-API `update-every-webhook` com `notifyReceivedGroups: true`. Quando você clicar num botão "Ativar notificações de grupo na Z-API" na tela de Comprovantes, a configuração é ativada automaticamente — sem precisar mexer no painel da Z-API.

### 3. Botão de diagnóstico na tela `/comprovantes`

Dentro do modal "Gerenciar Grupos" adiciono uma seção:
- **Botão "Ativar notificações de grupo (Z-API)"** → chama a função do passo 2
- **Lista de "Eventos recentes recebidos (últimos 10 min)"** → puxa de `webhook_eventos_brutos` mostrando: hora, tipo (texto/imagem/doc), nome do chat, ID do grupo. Botão refresh.
- Assim você manda mensagem no grupo, atualiza, e vê na hora se chegou.

### 4. Validação de membro do grupo

Esse passo é manual seu: confirmar que o número WhatsApp da instância Delookii é participante do grupo "Confirmação de Pagamento 💰". Se não for, adicionar.

## Fluxo de teste depois de implementado

1. Aperta o botão "Ativar notificações de grupo (Z-API)" → toast confirma sucesso
2. Confirma que a instância Delookii está no grupo de Pagamento
3. Manda uma foto no grupo
4. Atualiza a lista de eventos brutos no modal → deve aparecer linha com `message_type: image` e `group_whatsapp_id: 120363402446093422-group`
5. Em alguns segundos, o comprovante aparece na tabela já processado pela IA, com cor 💰 do grupo Pagamento
6. Você responde no grupo confirmando o registro

## Observação

Não preciso mexer na lógica de processamento da IA — ela já está pronta e testada. O bloqueio é puramente de configuração da Z-API.

Aprova pra eu executar os passos 1, 2 e 3? Passo 4 fica com você no celular.