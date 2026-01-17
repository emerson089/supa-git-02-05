# Objetivo
Estabilizar a aba **Feira** sem “recomeçar do zero”, mantendo seus dados atuais (estoque, clientes, pedidos e histórico). O erro principal hoje ao criar uma **Nova carga** é:

> new row for relation "estoque_movimentacoes" violates check constraint "estoque_movimentacoes_tipo_check"

Isso acontece porque o banco permite apenas `tipo IN ('entrada','saida')`, mas o código da Feira grava `ENVIO_FEIRA`, `RETORNO_FEIRA`, `VENDA_FEIRA`, `ESTORNO_FEIRA`.

# Escopo
1) Corrigir o schema do banco para aceitar os tipos de movimentação usados pela Feira.
2) Validar o fluxo de “Nova carga” end-to-end.
3) (Opcional, mas recomendado) Prevenir recorrência centralizando os tipos de movimentação e melhorando a mensagem de erro.

# Plano passo a passo

## 1) Confirmar estado atual (diagnóstico rápido)
- Verificar que a constraint atual realmente está limitada a `entrada/saida`.
- Verificar que `estoque_movimentacoes` está vazio (não haverá impactos de migração de dados).

## 2) Aplicar correção no banco (schema)
Criar uma migração SQL que:
- Remove a constraint antiga `estoque_movimentacoes_tipo_check`.
- Cria a nova constraint aceitando os tipos abaixo:
  - `entrada`
  - `saida`
  - `ENVIO_FEIRA`
  - `RETORNO_FEIRA`
  - `VENDA_FEIRA`
  - `ESTORNO_FEIRA`

SQL (conteúdo da migração):
```sql
ALTER TABLE public.estoque_movimentacoes
DROP CONSTRAINT IF EXISTS estoque_movimentacoes_tipo_check;

ALTER TABLE public.estoque_movimentacoes
ADD CONSTRAINT estoque_movimentacoes_tipo_check
CHECK (tipo = ANY (ARRAY[
  'entrada'::text,
  'saida'::text,
  'ENVIO_FEIRA'::text,
  'RETORNO_FEIRA'::text,
  'VENDA_FEIRA'::text,
  'ESTORNO_FEIRA'::text
]));
```

## 3) Testar o fluxo “Nova carga” (Feira)
Após a migração:
- Abrir **Feira → Nova carga → selecionar modelo → Criar carga**.
- Confirmar que:
  1. `transferencias` é criada (status `em_andamento`).
  2. `transferencia_itens` é criada.
  3. `estoque_por_local` é atualizado (Central diminui, Banca aumenta).
  4. `estoque_movimentacoes` recebe `ENVIO_FEIRA` sem erro.

## 4) Testar retorno e venda
- Registrar retorno de uma carga e validar gravações:
  - `RETORNO_FEIRA`
  - `VENDA_FEIRA`

## 5) (Opcional) Blindagem para não voltar
- Centralizar os tipos de movimentação em um `const`/type (ex.: `MovimentacaoTipo`) usado por todos os hooks (`useTransferencias`, `useRecalcularEstoque`, `useEstornarCarga`).
- Melhorar mensagem do toast quando ocorrer erro de backend, incluindo “o que fazer” (ex.: “atualize/contate suporte” não; e sim “houve incompatibilidade de schema, já corrigida”).

# Arquivos envolvidos
- **Schema/migração**: novo arquivo em `supabase/migrations/` (ou migração via ferramenta de banco).
- (Opcional) Código:
  - `src/hooks/useTransferencias.ts`
  - `src/hooks/useRecalcularEstoque.ts`
  - `src/hooks/useEstornarCarga.ts`

# Critérios de aceite
- Criar carga na Feira não gera mais erro de constraint.
- Registrar retorno e concluir carga funciona.
- Movimentações da Feira são registradas em `estoque_movimentacoes` com os novos tipos.

# Riscos/observações
- Migração é segura porque só altera a constraint de validação do campo `tipo`.
- Se no futuro você quiser ainda mais robustez, podemos trocar o CHECK por uma enum/lookup table — mas não é necessário para destravar agora.