# Plano: Melhoria Visual do Resumo de Pagamentos no WhatsApp

Este plano detalha a reestruturação do layout das mensagens de confirmação de pagamento enviadas via WhatsApp para o grupo de "Confirmação de Pagamento".

## 1. Análise da Situação Atual
- **Arquivo:** `supabase/functions/webhook-comprovantes/index.ts`
- **Problema:** O resumo atual utiliza barras verticais (`|`) e uma única linha por pagamento, o que torna a leitura difícil em telas de celular.
- **Objetivo:** Implementar a "Opção A" (Layout Detalhado) que utiliza emojis, quebras de linha e separadores visuais.

## 2. Mudanças Propostas

### 2.1 Alteração na Formatação dos Itens
Modificar o loop que preenche `listaPagamentos` para usar um formato multi-linha com emojis:
- `👤 Pagador:`
- `💰 Valor:`
- `🕒 Data:`

### 2.2 Alteração na Montagem da Mensagem Final
- Alterar o cabeçalho para `✅ *CONFIRMAÇÃO DE PAGAMENTO*`.
- Utilizar `──────────────────` como separador entre os pagamentos.
- Destacar o **Total do Dia** com negrito e emoji.

## 3. Tarefas
1. [x] Editar `supabase/functions/webhook-comprovantes/index.ts`.
2. [x] Modificar o `listaPagamentos.push` (Linhas 261-263).
3. [x] Modificar a construção da `msg` no bloco `else` (Linhas 285-288).
4. [x] Validar a lógica de separadores para garantir que o layout fique limpo mesmo com um único pagamento.

## 4. Verificação
- [x] O cabeçalho deve estar em caixa alta e negrito.
- [x] Cada campo deve ter seu respectivo emoji.
- [x] O total deve estar claramente destacado ao final.
