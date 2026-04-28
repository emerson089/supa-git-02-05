## Diagnóstico

A transmissão **está disparando mensagens** (a tela mostra "3 entregues / 0 falhas" e os envios para Ionara, Agenir e Paula apareceram nos logs), mas existem **dois bugs sérios de persistência** que comprometem o controle do disparo:

### Bug 1 — Tabela `campanhas_historico` não existe
O hook `useMassSending` chama `saveCampanhaHistorico` ao final da transmissão e também `getEnviosHojeCount` para mostrar "X enviados hoje". Verifiquei no banco:
- Existem só `catalogos` e `catalogo_envios`.
- `campanhas_historico`, `blacklist` e `perfil_configuracoes` **não existem**.
- Resultado: toda chamada falha silenciosamente (`as any` esconde o erro), o "enviados hoje" sempre retorna 0, blacklist nunca bloqueia ninguém, e nenhum histórico é salvo.

### Bug 2 — Coluna errada em `catalogo_envios`
O `useMassSending` e o filtro de "já receberam" assumem `created_at`, mas a coluna real é `enviado_em`. O insert via `supabase.from('catalogo_envios').insert(...)` funciona (default), mas qualquer query baseada em `created_at` quebra.

Confirmação adicional: `select count(*) from catalogo_envios where enviado_em >= now() - interval '1 hour'` retornou **0**. Ou seja, **mesmo com a UI mostrando "3 entregues", nenhum registro foi gravado em `catalogo_envios`**. O `registrarEnvio` em `TransmissaoManagerModal.tsx` está chamando `.insert(...)` sem `.select()` nem checagem — o erro está sendo engolido pelo `try/catch` que só faz `console.error`.

A causa mais provável do insert falhar: política de RLS na tabela `catalogo_envios` está bloqueando, ou falta a coluna esperada. Vou validar com `select * from catalogo_envios limit 1` durante a implementação.

### Bug 3 — Logs do `send-whatsapp` vazios
Não há logs recentes do edge function `send-whatsapp` no period analisado, embora a UI mostre envios. Isso pode indicar:
- Os logs ainda não foram indexados (delay de analytics), OU
- A função está sendo chamada mas sem `console.log` no caminho de sucesso.

Vou verificar novamente após a correção e adicionar logs estruturados se necessário.

## O que vamos fazer

### 1. Criar as tabelas faltantes (migration)

```text
campanhas_historico
  - id (uuid pk)
  - user_id (uuid, ref auth.users)
  - nome_campanha (text)
  - catalogo_id (uuid null)
  - total_contatos (int)
  - sucessos (int)
  - falhas (int)
  - filtros_aplicados (jsonb)
  - velocidade (text)
  - data_disparo (timestamptz default now())

blacklist
  - id (uuid pk)
  - user_id (uuid)
  - telefone (text)
  - motivo (text)
  - origem (text)
  - created_at (timestamptz default now())
  - unique(user_id, telefone)

perfil_configuracoes
  - user_id (uuid pk)
  - limite_diario_mensagens (int default 100)
  - pausa_inteligente (bool default true)
  - updated_at (timestamptz default now())
```

Todas com RLS: o usuário autenticado só lê/escreve registros próprios (`user_id = auth.uid()`).

### 2. Corrigir referência de coluna em `catalogo_envios`

Em `useMassSending.ts` e qualquer query, trocar `created_at` por `enviado_em`. Validar que o `insert` em `registrarEnvio` (TransmissaoManagerModal.tsx linha 312-323) está realmente persistindo — se RLS estiver bloqueando, ajustar a policy para permitir insert quando `user_id = auth.uid()`.

### 3. Tornar erros visíveis em vez de silenciosos

- `registrarEnvio`: passar a checar `error` retornado pelo insert e logar com toast em modo debug.
- `useMassSending`: trocar os `console.error` mudos por throws ou retornos tipados.
- Adicionar um `console.log` de início/fim no `send-whatsapp` para facilitar diagnóstico via logs.

### 4. Validar fim-a-fim

Depois das migrations e correções:
- Disparar nova transmissão de teste pequena (3-5 contatos).
- Verificar via SQL que `catalogo_envios` recebeu os registros.
- Verificar que `campanhas_historico` recebeu o resumo.
- Verificar logs do `send-whatsapp` (com novos `console.log`).

## Por que isso importa

Hoje, mesmo que o WhatsApp esteja entregando os PDFs, **o sistema está cego**:
- O contador "X enviados hoje" sempre mostra 0.
- O filtro "não enviar de novo para quem já recebeu este catálogo" não funciona — todos os clientes seriam reenviados na próxima campanha.
- A blacklist (LGPD/opt-out manual) é ignorada.
- Não há histórico de campanhas para auditoria.

## Resumo das mudanças

1. Migration criando 3 tabelas com RLS.
2. Patch em `src/hooks/useMassSending.ts` (coluna correta, melhor tratamento de erro).
3. Patch em `src/components/clientes/TransmissaoManagerModal.tsx` (validar insert do `registrarEnvio`).
4. Patch em `supabase/functions/send-whatsapp/index.ts` (logs de início/fim do envio).
5. Re-deploy do `send-whatsapp` e teste de disparo controlado.
