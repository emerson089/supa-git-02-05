

## Plano: Corrigir Duplicatas e Implementar CRUD de Tipos de Ajuste

### Diagnóstico do Problema

**Causa raiz identificada**: Os tipos de ajuste foram criados em duplicidade no banco de dados. A função `useCriarTiposPadrao()` foi chamada múltiplas vezes (provavelmente em sessões diferentes ou por race condition), inserindo os mesmos 6 tipos padrão duas vezes para o mesmo usuário.

**Evidência no banco**:
| nome | count |
|------|-------|
| Bonificação / Brinde | 2 |
| Devolução de cliente | 2 |
| Erro de lançamento | 2 |
| Inventário / Conferência física | 2 |
| Outro | 2 |
| Perda / Avaria | 2 |

---

## Solução em 3 Partes

### Parte 1: Correção no Banco de Dados

**Migração SQL necessária:**

1. **Remover registros duplicados** (manter apenas o mais antigo por nome/user)
2. **Criar constraint UNIQUE** em `(user_id, nome)` para impedir futuras duplicações
3. **Corrigir a função de criação de tipos padrão** para usar `ON CONFLICT DO NOTHING`

```sql
-- 1. Remover duplicados mantendo o registro mais antigo por (user_id, nome)
DELETE FROM tipos_ajuste_estoque
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, nome) id
  FROM tipos_ajuste_estoque
  ORDER BY user_id, nome, created_at ASC
);

-- 2. Adicionar constraint UNIQUE para evitar duplicações futuras
ALTER TABLE tipos_ajuste_estoque
ADD CONSTRAINT unique_tipo_ajuste_per_user UNIQUE (user_id, nome);
```

---

### Parte 2: Ajustes no Frontend (Hooks)

**Arquivo**: `src/hooks/useTiposAjuste.ts`

| Mudança | Descrição |
|---------|-----------|
| `useCriarTiposPadrao` | Usar `upsert` com `onConflict: 'user_id,nome'` ou `INSERT ... ON CONFLICT DO NOTHING` |
| Hooks de CRUD | Adicionar hooks para criar, editar, desativar e excluir tipos |

**Novos hooks a implementar:**

```typescript
// Criar novo tipo
export function useCriarTipoAjuste()

// Editar nome do tipo
export function useEditarTipoAjuste()

// Desativar tipo (soft delete)
export function useDesativarTipoAjuste()

// Excluir tipo (hard delete - só se não usado)
export function useExcluirTipoAjuste()

// Verificar se tipo está em uso
export function useTipoAjusteEmUso(tipoId: string)
```

---

### Parte 3: Nova Tela de Configurações

**Rota**: `/configuracoes/tipos-ajuste`

**Acesso**: Apenas `admin` e `gerente`

**Localização no menu**: Adicionar item "Tipos de Ajuste" no sidebar, abaixo de "Usuários" em Configurações

#### Interface da Tela

```text
┌────────────────────────────────────────────────────────────────────┐
│ ⚙️ Tipos de Ajuste                           [+ Novo Tipo]         │
├────────────────────────────────────────────────────────────────────┤
│ 🔍 Buscar tipo...                                                  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Inventário / Conferência física          🟢 Ativo    [⋮]    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Perda / Avaria                           🟢 Ativo    [⋮]    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Erro de lançamento                       🟢 Ativo    [⋮]    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Bonificação / Brinde                     🟢 Ativo    [⋮]    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Devolução (antigo)                       ⚪ Inativo  [⋮]    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

#### Menu de Ações (⋮)

- **Editar nome** → Abre modal de edição
- **Desativar** → Define `ativo = false` (ação padrão)
- **Reativar** (se inativo) → Define `ativo = true`
- **Excluir permanentemente** → Só habilitado se não houver uso em `estoque_movimentacoes`

#### Modal de Criação/Edição

```text
┌────────────────────────────────────────┐
│ ➕ Novo Tipo de Ajuste              X  │
├────────────────────────────────────────┤
│                                        │
│ Nome do Tipo *                         │
│ ┌────────────────────────────────────┐ │
│ │ Ex: Devolução ao fornecedor       │ │
│ └────────────────────────────────────┘ │
│                                        │
│ ⚠️ Este nome já existe               │ ← (validação em tempo real)
│                                        │
├────────────────────────────────────────┤
│               [Cancelar] [Salvar]      │
└────────────────────────────────────────┘
```

#### Modal de Exclusão

```text
┌────────────────────────────────────────┐
│ 🗑️ Excluir Tipo de Ajuste           X  │
├────────────────────────────────────────┤
│                                        │
│ Deseja excluir permanentemente o tipo  │
│ "Perda / Avaria"?                      │
│                                        │
│ ⚠️ Este tipo está em uso em 15        │
│ movimentações e não pode ser excluído. │
│ Utilize "Desativar" como alternativa.  │
│                                        │
├────────────────────────────────────────┤
│           [Cancelar] [Desativar]       │
└────────────────────────────────────────┘

-- OU se não estiver em uso --

┌────────────────────────────────────────┐
│ 🗑️ Excluir Tipo de Ajuste           X  │
├────────────────────────────────────────┤
│                                        │
│ Deseja excluir permanentemente o tipo  │
│ "Teste"?                               │
│                                        │
│ ✅ Este tipo não está em uso e pode    │
│ ser excluído com segurança.            │
│                                        │
├────────────────────────────────────────┤
│           [Cancelar] [Excluir]         │
└────────────────────────────────────────┘
```

---

## Arquivos a Serem Criados/Modificados

### Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/ConfigTiposAjuste.tsx` | Tela CRUD de tipos de ajuste |

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useTiposAjuste.ts` | Adicionar hooks de CRUD, corrigir `useCriarTiposPadrao` |
| `src/components/layout/AppSidebar.tsx` | Adicionar item "Tipos de Ajuste" no menu |
| `src/components/layout/BottomNavigation.tsx` | Adicionar acesso mobile se necessário |
| `src/App.tsx` | Adicionar rota `/configuracoes/tipos-ajuste` |

### Migração SQL

```sql
-- Remover duplicados
DELETE FROM tipos_ajuste_estoque
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, nome) id
  FROM tipos_ajuste_estoque
  ORDER BY user_id, nome, created_at ASC
);

-- Constraint UNIQUE
ALTER TABLE tipos_ajuste_estoque
ADD CONSTRAINT unique_tipo_ajuste_per_user UNIQUE (user_id, nome);
```

---

## Fluxo de Validação

### Ao Criar Novo Tipo

1. Frontend: Trim do nome, verificar se não está vazio
2. Frontend: Verificar duplicidade antes de enviar (busca local)
3. Backend: Constraint UNIQUE impede inserção duplicada
4. Se erro de constraint: Mostrar mensagem "Este nome já existe"

### Ao Editar Tipo

1. Mesma validação de trim e duplicidade
2. Não permitir editar para um nome já existente

### Ao Desativar Tipo

1. Define `ativo = false`
2. Tipo continua aparecendo em movimentações antigas no histórico
3. Tipo não aparece mais nos selects de "Ajustar Estoque" e "Filtro do Relatório"

### Ao Excluir Tipo

1. Verificar se há uso em `estoque_movimentacoes.tipo_ajuste_id`
2. Se houver uso: Bloquear exclusão, sugerir desativar
3. Se não houver uso: Permitir DELETE definitivo

---

## Critérios de Aceite

- ✅ Duplicatas removidas do banco de dados
- ✅ Constraint UNIQUE impede novas duplicações
- ✅ Cada tipo aparece apenas uma vez nos selects
- ✅ Tela CRUD funcional em `/configuracoes/tipos-ajuste`
- ✅ CRUD: Listar, criar, editar nome, desativar, excluir
- ✅ Validação de duplicidade no frontend e backend
- ✅ Tipos inativos não aparecem nos selects
- ✅ Histórico continua mostrando tipos mesmo se inativos
- ✅ Exclusão só permitida se tipo não estiver em uso
- ✅ Funcionalidades existentes não quebradas

