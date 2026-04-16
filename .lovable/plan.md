

## Plano: Filtrar grupo + Botão de excluir comprovantes

### 1. Configurar filtro do grupo "Feira - Delookii"

**ID descoberto:** `120363043122353365-group`

A lógica de filtro **já existe** em `webhook-comprovantes/index.ts` (linha que checa `WHATSAPP_GROUP_ID`). Basta adicionar o secret com esse valor.

**Ação:** Vou solicitar a adição do secret `WHATSAPP_GROUP_ID` com valor `120363043122353365-group` via tool `add_secret`. Após adicionado, qualquer mensagem fora desse grupo será automaticamente ignorada (já visto nos seus dados que estavam vindo comprovantes de números privados como `557781377537`, grupos `558788528673`, `155572506751145@lid` etc — tudo isso será filtrado).

**Importante:** Você precisa reapontar o webhook do Z-API **de volta** para `webhook-comprovantes` (saindo do `discover-group-id`):
```
https://xoyyhtxakbrlzykthdca.supabase.co/functions/v1/webhook-comprovantes
```

### 2. Adicionar botão de excluir comprovantes

**`src/hooks/useComprovantes.ts`:** adicionar mutation `deleteComprovante`:
- `supabase.from('comprovantes').delete().eq('id', id)`
- Invalida query, exibe toast de sucesso
- Exporta `deleteComprovante` e `isDeleting`

**`src/pages/Comprovantes.tsx`:** adicionar coluna de ações:
- Ícone lixeira (vermelho) ao lado do botão de visualizar
- Ao clicar, abre `AlertDialog` de confirmação ("Tem certeza? Esta ação não pode ser desfeita.")
- Ao confirmar, chama `deleteComprovante(id)`
- Funciona tanto na tabela desktop quanto nos cards mobile

**Permissões:** RLS atual permite DELETE apenas para admin (`Admin can manage comprovantes` com `FOR ALL`). Gerentes não podem excluir — comportamento adequado.

### Arquivos alterados
- `src/hooks/useComprovantes.ts` — adicionar mutation de delete
- `src/pages/Comprovantes.tsx` — botão lixeira + AlertDialog de confirmação

### Fluxo após implementação
1. Adiciono o secret `WHATSAPP_GROUP_ID = 120363043122353365-group`
2. Implemento o botão de excluir
3. Você reaponta o webhook Z-API para `webhook-comprovantes` (volta da URL de descoberta)
4. Você pode excluir os comprovantes errados que já entraram (de outros chats)
5. A partir daí, só comprovantes do grupo "Feira - Delookii" serão processados

