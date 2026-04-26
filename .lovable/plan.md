# Plano: Reativar Cobranças Automáticas

## Diagnóstico (resumo)
A funcionalidade está completamente quebrada porque a migration de infra **nunca foi aplicada** ao banco. Faltam:
- Tabelas `templates_cobranca` e `cobrancas_enviadas`
- Colunas `excluir_cobranca_automatica` em `clientes` e `pedidos`
- Extensão `pg_cron` e os 3 jobs agendados
- Declaração de `cobranca-pendentes` no `supabase/config.toml` (precisa de `verify_jwt = false` para o cron chamar)
- O bloco DO $$ da migration original tentava ler GUCs `app.settings.*` que não existem no Supabase gerenciado → cron jamais foi criado mesmo se a migration tivesse rodado

## Etapa 1 — Migration única (substitui a anterior, que está obsoleta)

Criar nova migration `*_cobrancas_automaticas_v2.sql` com:

1. **Extensões**: `CREATE EXTENSION IF NOT EXISTS pg_cron;` e `pg_net;`
2. **Colunas de exclusão**:
   - `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS excluir_cobranca_automatica BOOLEAN NOT NULL DEFAULT false;`
   - `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS excluir_cobranca_automatica BOOLEAN NOT NULL DEFAULT false;`
3. **Tabela `templates_cobranca`** com RLS `auth.uid() = user_id` e UNIQUE(user_id, tentativa)
4. **Tabela `cobrancas_enviadas`** com:
   - FK em pedido_id ON DELETE CASCADE
   - UNIQUE(pedido_id, tentativa) para evitar reenvio
   - RLS: SELECT para `authenticated` (true), ALL para `service_role`
5. **Cron jobs** — agendados com URL hardcoded do projeto e `SUPABASE_ANON_KEY` no Authorization (segue a `external-api-access-policy`):
   - `cobranca-quarta-14h` → cron `0 17 * * 3` (14h BRT) → POST `{tentativa:1}`
   - `cobranca-quinta-9h` → cron `0 12 * * 4` (9h BRT) → POST `{tentativa:2}`
   - `cobranca-quinta-15h` → cron `0 18 * * 4` (15h BRT) → POST `{tentativa:3}`
   - Antes de criar, fazer `cron.unschedule` defensivo dos mesmos nomes para idempotência

## Etapa 2 — Declarar a Edge Function

Adicionar ao `supabase/config.toml`:
```toml
[functions.cobranca-pendentes]
verify_jwt = false
```
Necessário porque o cron interno chama a função sem sessão de usuário; o controle de acesso real é feito pela `service_role_key` que a função usa internamente para escrever no banco.

## Etapa 3 — Corrigir TypeScript em `src/pages/ConfigCobrancas.tsx`

Após a migration rodar, o `types.ts` será regenerado automaticamente e os 6 erros somem sozinhos. Não precisa cast `as any` — vai funcionar nativo. Apenas verificar:
- `setHistorico(data ?? [])` na linha 166 — vai aceitar pois o tipo `cobrancas_enviadas` agora existe
- `setClientes(data ?? [])` na linha 179 — idem para a coluna `excluir_cobranca_automatica`
- `.update({ excluir_cobranca_automatica: valor })` na linha 190 — idem

## Etapa 4 — Não tocar (fora de escopo)

- `useMassSending.ts` usa `blacklist` e `campanhas_historico` — pertencem ao módulo de **transmissão de catálogo**, não cobrança. Já estão com `as any` e o build não reclama. Fica para outro ticket.
- `cobranca-pendentes/index.ts` — código está correto, não precisa alterar.

## Etapa 5 — QA pós-deploy

1. Abrir `/configuracoes/cobrancas` → confirmar que carrega sem erros e que os 3 templates padrão aparecem editáveis
2. Salvar 1 template → verificar registro em `templates_cobranca` via DB
3. Marcar 1 cliente como excluído → verificar `clientes.excluir_cobranca_automatica = true`
4. Botão "Disparar agora" da 1ª cobrança → confirmar que invoca a function, retorna `{enviados, falhas}` e popula `cobrancas_enviadas`
5. `SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'cobranca-%'` → deve retornar 3 linhas ativas
6. Confirmar que reenviar a mesma tentativa para o mesmo pedido **não duplica** (constraint UNIQUE + lógica `idsJaEnviados` na função)

## Riscos
- **pg_cron em managed Supabase**: a extensão é suportada mas só pode ser instalada no schema `pg_catalog`/`extensions` em projetos com plan adequado. Se falhar, alternativa é usar Supabase Cron (UI) — preciso confirmar disponibilidade ao rodar a migration.
- **Z-API**: a função depende dos 3 secrets `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN` (já configurados, confirmado).
- **Volume**: o loop tem `setTimeout 2s` entre envios — para 50 pedidos, leva ~100s, próximo do timeout default de edge function (150s). Aceitável para o volume atual; monitorar.

## Arquivos tocados
- `supabase/migrations/{timestamp}_cobrancas_automaticas_v2.sql` (novo)
- `supabase/config.toml` (adicionar bloco)
- Nenhum arquivo TS precisa edição manual — `types.ts` é regenerado automaticamente
