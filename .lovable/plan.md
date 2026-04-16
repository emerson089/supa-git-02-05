

## Plano: Criar tabela comprovantes + atualizar types.ts + remover `as any`

### Situação atual
- Os arquivos das Edge Functions (`webhook-comprovantes/index.ts` e `discover-group-id/index.ts`) **já existem** no código-fonte
- As entradas no `config.toml` **já existem** com `verify_jwt = false`
- A migration `20260416082420_add_comprovantes.sql` **existe** no código mas **não foi aplicada** — a tabela `comprovantes` não existe no banco de dados
- O `types.ts` não contém a definição de `comprovantes` (é auto-gerado e não refletiu a tabela porque ela não existe)
- Os hooks usam `as any` como workaround

### O que será feito

**1. Aplicar a migração SQL para criar a tabela `comprovantes`**
Executar a migration existente via ferramenta de migração do banco:
- Criar tipo `comprovante_status` (enum: confirmado, pendente_revisao, rejeitado)
- Criar tabela `comprovantes` com todas as colunas (valor, data_pagamento, nome_pagador, banco_origem, tipo_pagamento, chave_pix, imagem_url, dados_brutos, status, grupo_whatsapp, numero_remetente, observacoes)
- Trigger `updated_at`, RLS habilitado, políticas para admin/gerente
- Índices em `status` e `created_at`

**2. Atualizar `src/integrations/supabase/types.ts`**
Adicionar a definição da tabela `comprovantes` no objeto `Tables` com Row/Insert/Update types correspondentes. Embora o arquivo seja auto-gerado, a adição manual é necessária para que os tipos reflitam a tabela recém-criada.

**3. Remover `as any` dos hooks**
- `src/hooks/useComprovantes.ts` — usar `supabase.from('comprovantes')` diretamente
- `src/hooks/useSalesTrendChart.ts` — idem

**4. Redeploy das Edge Functions**
Fazer deploy de `webhook-comprovantes` e `discover-group-id` para garantir que estejam ativas.

### Arquivos alterados
- `src/integrations/supabase/types.ts` (adicionar tipos da tabela comprovantes)
- `src/hooks/useComprovantes.ts` (remover `as any`)
- `src/hooks/useSalesTrendChart.ts` (remover `as any`)
- Migração SQL aplicada ao banco de dados

