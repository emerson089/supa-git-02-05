## Objetivo

Tornar a lista de **saudações aleatórias** totalmente configurável pelo usuário, com um campo dedicado dentro do modal de Envio em Massa (`TransmissaoManagerModal`), substituindo a lista hardcoded atual de 20 frases.

## Como vai funcionar (visão do usuário)

Dentro do modal **Envio em Massa**, será adicionado um novo bloco recolhível chamado **"Saudações Aleatórias"** com:

- Um **textarea** editável onde cada **linha = uma saudação**.
- Suporte a tags `{nome}`, `{cidade}`, `{estado}`, `{excursao}`.
- Botões: **Salvar**, **Restaurar Padrão** (volta às 20 frases atuais) e **Adicionar Linha**.
- Contador mostrando quantas saudações estão ativas.
- Dica visual explicando que a saudação só é prefixada quando a mensagem do catálogo **não contém** `{nome}`.

As saudações ficam salvas por usuário no banco e são carregadas automaticamente toda vez que o modal abrir. Se o usuário não tiver nenhuma personalizada, o sistema usa as 20 saudações padrão.

## Onde aparece

- **Apenas no modal de Envio em Massa** (`TransmissaoManagerModal`), conforme solicitado.
- O envio individual (botão de catálogo no card do cliente — `WhatsAppCatalogButton`) **continua usando sua lista curta atual** (sem alterações), pois o pedido é específico para a aba de envio em massa.

## Detalhes técnicos

**1. Banco de dados (migration)**

Adicionar coluna `saudacoes_personalizadas` em `perfil_configuracoes`:

```sql
ALTER TABLE public.perfil_configuracoes
ADD COLUMN IF NOT EXISTS saudacoes_personalizadas text[] NOT NULL DEFAULT '{}';
```

A tabela já tem RLS por `user_id = auth.uid()`, então herda as políticas existentes.

**2. Hook `useMassSending.ts`**

- Estender `getPerfilConfig` / `savePerfilConfig` para incluir `saudacoes_personalizadas: string[]`.
- Adicionar helper `getSaudacoes()` que retorna o array salvo OU o `SAUDACOES_PADRAO` quando vazio.

**3. Componente `TransmissaoManagerModal.tsx`**

- Extrair a constante `SAUDACOES` (linha 37) para `src/lib/saudacoes-padrao.ts` exportando `SAUDACOES_PADRAO`.
- Adicionar estado `saudacoesCustom: string[]` carregado de `perfil_configuracoes` no `useEffect` de abertura do modal.
- Substituir os dois pontos de uso (linhas 96 e 275) por uma função `pickSaudacao()` que sorteia a partir de `saudacoesCustom.length > 0 ? saudacoesCustom : SAUDACOES_PADRAO`.
- Novo bloco UI (entre o card de "Velocidade" e o de "Filtros"):
  - Header com chevron expand/collapse (mesmo padrão dos outros cards do modal).
  - `Textarea` controlado: `value={saudacoesCustom.join('\n')}` → onChange faz `split('\n')` e filtra linhas vazias no save.
  - Botões: **Salvar saudações** (chama `savePerfilConfig`), **Restaurar padrão** (preenche com `SAUDACOES_PADRAO`), **Limpar tudo**.
  - Badge: `{count} saudações ativas`.
  - Texto auxiliar: "Use `{nome}` para personalizar. A saudação só é adicionada quando a mensagem do catálogo não contém `{nome}`."

**4. Persistência e UX**

- Salvar é manual (botão), não auto-save, para evitar gravar a cada tecla.
- Toast de sucesso/erro no save.
- Validação leve: ignorar linhas vazias; permitir lista vazia (que cai no padrão).

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — adiciona coluna `saudacoes_personalizadas`.
- `src/lib/saudacoes-padrao.ts` — novo arquivo com `SAUDACOES_PADRAO`.
- `src/hooks/useMassSending.ts` — tipos e helper de saudações.
- `src/components/clientes/TransmissaoManagerModal.tsx` — nova UI + leitura/escrita + uso da lista dinâmica.

## Fora do escopo

- Não altera `WhatsAppCatalogButton` (envio individual).
- Não cria página separada de configuração — o campo vive dentro do próprio modal de envio em massa, conforme pedido.