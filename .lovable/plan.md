

## Plano atualizado: Múltiplos Catálogos + Mensagem Personalizada + Tooltip de formatação WhatsApp

Este plano incorpora o pedido anterior (múltiplos catálogos com mensagem personalizada) e adiciona o tooltip de formatação no campo de mensagem.

### 1. Migração SQL — Tabela `catalogos`

```sql
CREATE TABLE public.catalogos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mensagem TEXT NOT NULL DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.catalogos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own catalogos" ON public.catalogos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 2. Refatorar `ConfigCatalogo.tsx`

- Campo "Nome do catálogo" (input)
- Campo "Mensagem personalizada" (textarea) com placeholder sugerindo `{nome}`
- **Tooltip de formatação** ao lado do label da mensagem: ícone de info com texto explicando que `*texto*` fica **negrito**, `_texto_` fica _itálico_ e `~texto~` fica ~~riscado~~ no WhatsApp — usando o componente `Tooltip` já existente no projeto
- Upload com path único `{user_id}/catalogos/{uuid}.pdf`
- Listagem de todos os catálogos com ações: Ativar, Visualizar (iframe), Excluir
- Badge "Ativo" no catálogo marcado
- Migração automática do `oficial.pdf` legado na primeira carga

### 3. Refatorar `TransmissaoManagerModal.tsx`

- Buscar catálogos do usuário ao abrir
- Seletor (dropdown) para escolher qual catálogo enviar
- Usar `mensagem` do catálogo selecionado como `caption`, substituindo `{nome}` pelo primeiro nome do cliente
- Gerar `signedUrl` do `file_path` do catálogo escolhido

### 4. Refatorar `WhatsAppCatalogButton.tsx`

- Buscar catálogo ativo (`ativo = true`) do usuário
- Usar `file_path` e `mensagem` do catálogo ativo (com substituição de `{nome}`)

### Detalhe do tooltip de formatação

No campo "Mensagem personalizada", ao lado do label, haverá um ícone `Info` com tooltip contendo:

```
Dicas de formatação WhatsApp:
• *texto* → negrito
• _texto_ → itálico
• ~texto~ → riscado
• {nome} → nome do cliente
```

Usa o componente `Tooltip` de `@/components/ui/tooltip` já existente no projeto, mantendo o padrão visual Delookii.

### Arquivos alterados
- Nova migração SQL
- `src/pages/ConfigCatalogo.tsx` — reescrita completa
- `src/components/clientes/TransmissaoManagerModal.tsx` — seletor de catálogo
- `src/components/clientes/WhatsAppCatalogButton.tsx` — usar catálogo ativo do banco

