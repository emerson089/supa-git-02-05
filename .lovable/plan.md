
## Objetivo

Sair da lógica atual (1 ou 2 grupos hardcoded em secrets) e suportar **N grupos cadastráveis** pelo painel. Cada grupo terá:
- ID do grupo WhatsApp (ex: `120363402446093422-group`)
- Nome amigável (ex: "Confirmação de Pagamento 1")
- Ícone/emoji + cor (para diferenciar visualmente)
- Categorização padrão (Jeans / Alfaiataria / Não classificado / "perguntar via legenda J/A")
- Toggle ativo/inativo

E na aba **Comprovantes**, separar tudo por grupo com filtros e cards de totais por grupo.

---

## Diagnóstico do problema atual

A mensagem do grupo "Confirmação de pagamento 💰" (ID `120363402446093422-group`) não chegou no banco porque, mesmo com o secret `WHATSAPP_GROUP_ID_PAGAMENTOS` configurado, **olhando os logs recentes da edge function `webhook-comprovantes` só aparecem mensagens do grupo Feira (`120363043122353365-group`)**. Ou seja: o webhook da Z-API para o grupo de Pagamentos provavelmente **não está disparando para a URL da função** — a Z-API só envia eventos para grupos que estejam ativos na configuração dela, ou o grupo precisa receber ao menos uma mensagem após o webhook estar configurado.

Então além de refatorar para N grupos, precisamos validar/garantir que o webhook da Z-API está recebendo eventos do novo grupo. A nova arquitetura facilita isso porque vamos logar **TODA** mensagem que chega (mesmo de grupos não cadastrados) numa tabela de descoberta — assim o usuário vê na hora se a Z-API está mandando ou não.

---

## O que vai mudar

### 1. Banco de dados (migração)

**Nova tabela `grupos_comprovantes`:**
```
id uuid PK
user_id uuid
group_whatsapp_id text  -- ex "120363402446093422-group"
nome text               -- "Confirmação de Pagamento 1"
emoji text              -- "💰"
cor text                -- "emerald" | "blue" | "purple" | ...
categoria_padrao comprovante_categoria  -- default 'nao_classificado'
pedir_legenda_ja boolean default false   -- se true, usa lógica J/A da legenda
ativo boolean default true
created_at, updated_at
UNIQUE (user_id, group_whatsapp_id)
```
Com RLS: usuário gerencia os próprios; admin/gerente leem tudo.

**Nova tabela `webhook_eventos_brutos` (para descoberta/diagnóstico):**
```
id uuid PK
group_whatsapp_id text
sender text
chat_name text
message_type text  -- 'image' | 'document' | 'text' | ...
caption text
payload jsonb
created_at timestamptz
```
Mantém só os últimos 7 dias (ou últimos 200 registros) — serve pra você descobrir o ID de um grupo novo só de mandar uma mensagem nele.

### 2. Edge Function `webhook-comprovantes`

Refatorar para:
1. Toda chamada → grava em `webhook_eventos_brutos` (sempre, mesmo se não autorizado).
2. Buscar `grupos_comprovantes` ativos no banco em vez de ler secret.
3. Se `groupHost` não está cadastrado → retorna 200 com `{ok: true, grupo_nao_cadastrado: true}` (sem 401, pra Z-API não retentar) e segue o jogo.
4. Se cadastrado → processa imagem/PDF como hoje, mas:
   - Se `pedir_legenda_ja=true` → usa detector J/A da legenda (fluxo Feira atual).
   - Senão → usa `categoria_padrao` do grupo.
5. Mensagem de retorno por WhatsApp inclui o nome amigável do grupo: "✅ Comprovante registrado em *Confirmação de Pagamento 1*".
6. Remover dependência dos secrets `WHATSAPP_GROUP_ID` e `WHATSAPP_GROUP_ID_PAGAMENTOS` (ficam só como fallback durante a migração — vamos seedar a tabela com eles).

### 3. Nova página/seção: **Configuração de Grupos**

Acessível em `/config/grupos-comprovantes` (admin) ou aba dentro de Comprovantes:
- Lista de grupos cadastrados (cards) com nome, emoji, ID, categoria padrão, status ativo.
- Botão "Adicionar Grupo" → modal com:
  - Nome amigável
  - Group ID (com helper "Mande qualquer mensagem no grupo do WhatsApp e ele aparecerá aqui na lista de IDs descobertos")
  - **Seletor de "IDs descobertos recentemente"** — puxa de `webhook_eventos_brutos` os group_ids dos últimos 7 dias que ainda não estão cadastrados. Clicou, preencheu.
  - Emoji (campo livre + sugestões)
  - Cor (palette: emerald, blue, purple, amber, rose, sky, indigo)
  - Categoria padrão (radio: Jeans / Alfaiataria / Não classificado / "Perguntar via legenda J/A")
  - Toggle ativo
- Editar / excluir / ativar-desativar

### 4. Aba **Comprovantes** — UI

- **Cards de totais no topo**: virar **cards por grupo** (1 card por grupo cadastrado ativo) com nome, emoji, valor total e quantidade no período. Os cards Jeans/Alfaiataria/Não classificado/Validado continuam abaixo como visão agregada.
- **Filtro "Grupo / Origem"** já existe (linha 242 do `Comprovantes.tsx`) — agora popula direto da tabela `grupos_comprovantes` com os nomes amigáveis (não mais string-matching de ID).
- **Coluna "Origem"** na tabela exibe nome amigável + emoji + cor do grupo (chip colorido).
- **Tabs opcionais por grupo** acima da tabela (visão "todos" + 1 tab por grupo) — atalho rápido vs. dropdown.

### 5. Hook `useGruposComprovantes`

Novo hook React Query que faz CRUD de `grupos_comprovantes`. Usado na página de configuração e em `Comprovantes.tsx` para popular filtros/cards.

---

## Resumo técnico

| Item | Mudança |
|---|---|
| Migração SQL | Cria tabelas `grupos_comprovantes`, `webhook_eventos_brutos` + RLS + seed inicial dos 2 IDs atuais |
| Edge function | `webhook-comprovantes`: passa a ler grupos do DB, loga eventos brutos, suporta categoria por grupo |
| Frontend novo | `/config/grupos-comprovantes` (lista + modal CRUD), hook `useGruposComprovantes` |
| Frontend alterado | `Comprovantes.tsx`: cards por grupo, chip de origem, filtro populado do DB; `useComprovantes.ts`: já aceita filtro `grupo` |
| Secrets | Remover dependência de `WHATSAPP_GROUP_ID` / `WHATSAPP_GROUP_ID_PAGAMENTOS` (ficam só pra seed) |
| Diagnóstico | Tela mostra "IDs descobertos" pra você cadastrar grupo novo só mandando mensagem nele |

---

## Dúvidas antes de executar

1. **Onde colocar a configuração de grupos?**
   - (a) Página própria em `/config/grupos-comprovantes` no menu Configurações
   - (b) Aba "Configurar Grupos" dentro da própria tela `/comprovantes`
   - (c) Botão "⚙️ Grupos" no header da tela Comprovantes que abre um drawer

2. **Nos cards de totais do topo da aba Comprovantes**, prefere:
   - (a) Manter o layout atual (Jeans / Alfaiataria / Pendente / Validado) e adicionar **1 linha extra de cards por grupo** abaixo
   - (b) Substituir os cards atuais por **cards por grupo** e mostrar Jeans/Alfaiataria só nos grupos que usam categorização J/A
   - (c) Layout em 2 colunas: à esquerda agregado (Jeans/Alfaiataria/Pendente), à direita cards por grupo

Aprove o plano (e responda as 2 dúvidas) que eu executo tudo numa tacada só.
