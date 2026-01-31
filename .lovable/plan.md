

## Plano: Melhorias no Sistema de Estoque

### Resumo das Alterações
Quatro melhorias solicitadas:
1. **Filtro de Modelos (Relatório de Saídas)**: Rolagem com mouse e botão "Selecionar todos"
2. **Tipos de Ajuste de Estoque**: Padronização com tabela de tipos
3. **Filtro por Tipo de Ajuste no Relatório**: Novo filtro condicional
4. **Histórico de Movimentações**: Estado vazio informativo e lista detalhada

---

## 1. Filtro de Modelos - Melhorias de UX

### Arquivo Impactado
- `src/components/estoque/RelatorioSaidasModal.tsx`

### Alterações

| Mudança | Descrição |
|---------|-----------|
| max-height + overflow | Adicionar `max-h-[200px] overflow-y-auto` no container da lista |
| Botão "Selecionar todos" | Exibir quando houver busca com 2+ resultados filtrados |
| Contador | Melhorar exibição de modelos selecionados |

### UI Proposta

```
┌────────────────────────────────────────┐
│  🔍 alfa                               │
├────────────────────────────────────────┤
│  [Selecionar todos (6)]                │
├────────────────────────────────────────┤
│  ☐ Calça Alfaiataria Cinza - 900      │ ← max-height: 200px
│  ☑ Calça Alfaiataria Marrom - 800     │   overflow-y: auto
│  ☐ Calça Alfaiataria Mom - 886        │   scroll via mouse/trackpad
│  ...                                   │
└────────────────────────────────────────┘
│  2 modelo(s) selecionado(s)            │
│  [Limpar seleção]                      │
└────────────────────────────────────────┘
```

---

## 2. Tipos de Ajuste de Estoque

### Alterações no Banco de Dados

**Nova Tabela: `tipos_ajuste_estoque`**

| Coluna | Tipo | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | No | gen_random_uuid() |
| user_id | uuid | No | - |
| nome | text | No | - |
| ativo | boolean | No | true |
| created_at | timestamp | No | now() |

**Dados Iniciais Sugeridos:**
- Inventário / Conferência física
- Perda / Avaria
- Erro de lançamento
- Bonificação / Brinde
- Devolução de cliente
- Outro

**Alteração na Tabela `estoque_movimentacoes`**

| Coluna Nova | Tipo | Nullable |
|-------------|------|----------|
| tipo_ajuste_id | uuid | Yes |

**RLS Policies:**
- SELECT: user_id = auth.uid()
- INSERT/UPDATE/DELETE: user_id = auth.uid()

### Arquivos Impactados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useEstoquePorLocalGerenciamento.ts` | Adicionar hook `useTiposAjuste()` e passar `tipo_ajuste_id` na mutation |
| `src/components/estoque/AjusteEstoqueModal.tsx` | Substituir textarea por Select de tipos + campo observação opcional |

### Nova Interface do Modal Ajustar Estoque

```
┌────────────────────────────────────────┐
│ Ajustar Estoque                     X  │
├────────────────────────────────────────┤
│ [Imagem] Short Alfaiataria - 163       │
│          Cód: Modelo Manual • R$ 25.00 │
├────────────────────────────────────────┤
│  Estoque Atual    Novo Estoque   Dif.  │
│  [    11    ]     [    11    ]    0    │
├────────────────────────────────────────┤
│ Tipo de Ajuste *                       │
│ ┌──────────────────────────────────┐   │
│ │ Selecione o tipo...          ▼  │   │
│ └──────────────────────────────────┘   │
│                                        │
│ Observação (opcional)                  │
│ ┌──────────────────────────────────┐   │
│ │ Detalhe adicional se necessário  │   │
│ └──────────────────────────────────┘   │
├────────────────────────────────────────┤
│               [Cancelar] [Salvar]      │
└────────────────────────────────────────┘
```

### Validação
- Bloquear salvamento se `tipo_ajuste_id` não estiver selecionado
- Observação passa a ser opcional

---

## 3. Filtro por Tipo de Ajuste no Relatório

### Comportamento
- O filtro só aparece quando "Ajuste/Venda" estiver selecionado no Tipo de Saída
- Multi-select com os tipos cadastrados na tabela `tipos_ajuste_estoque`
- Aplicar `.in('tipo_ajuste_id', [ids])` na query

### Arquivos Impactados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useRelatorioSaidas.ts` | Adicionar `tipoAjusteIds?: string[]` ao filtro e à query; hook `useTiposAjusteParaFiltro()` |
| `src/components/estoque/RelatorioSaidasModal.tsx` | Adicionar filtro condicional de tipos de ajuste |

### UI Proposta

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Data Inicial   Data Final   Local        Tipo Saída     Modelos        │
│ [01/01/2026]   [31/01/26]   [Loja ▼]     [Ajuste  ▼]   [3 modelo(s)]   │
├─────────────────────────────────────────────────────────────────────────┤
│ Tipo de Ajuste (visível apenas quando Tipo Saída = Ajuste)              │
│ ┌─────────────────────────────────────────────────────────────────┐     │
│ │ Inventário, Perda                                           ▼  │     │
│ └─────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Histórico de Movimentações - Melhorias

### Arquivo Impactado
- `src/components/estoque/HistoricoMovimentacoesModal.tsx`
- `src/hooks/useEstoquePorLocalGerenciamento.ts`

### Estado Vazio Melhorado

```
┌────────────────────────────────────────┐
│ Histórico de Movimentações          X  │
├────────────────────────────────────────┤
│ [Imagem] Short Alfaiataria - 163       │
│          Cód: Modelo Manual            │
│          Local: Loja Parque das Feiras │
├────────────────────────────────────────┤
│                                        │
│         📦                             │
│                                        │
│  Nenhuma movimentação encontrada       │
│  nos últimos 90 dias                   │
│                                        │
│  Possíveis causas:                     │
│  • Este item não teve movimentação     │
│    neste período                       │
│  • O local selecionado não tem         │
│    histórico para este item            │
│                                        │
│  ┌──────────────────┐  ┌────────────┐  │
│  │Buscar desde início│  │ Atualizar │  │
│  └──────────────────┘  └────────────┘  │
│                                        │
├────────────────────────────────────────┤
│                           [Fechar]     │
└────────────────────────────────────────┘
```

### Lista Detalhada de Movimentações

Cada card de movimentação mostrará:

```
┌────────────────────────────────────────────────────────────────┐
│ 📅 31/01/2026 14:35                            🏷️ Ajuste Saída │
├────────────────────────────────────────────────────────────────┤
│ Quantidade: -5 peças                                           │
│ Saldo: 16 → 11                                                 │
│                                                                │
│ 📍 Loja Parque das Feiras                                      │
│ 📋 Tipo: Inventário                                            │
│ 💬 Obs: Conferência física realizada                           │
│ 👤 Usuário: admin@empresa.com                                  │
└────────────────────────────────────────────────────────────────┘
```

### Dados Adicionais na Query

Alterar `useHistoricoMovimentacoesItem` para incluir:
- `tipo_ajuste_id` → join com `tipos_ajuste_estoque.nome`
- Local origem/destino (para transferências)
- `transferencia_id` como referência
- Ordenar por `created_at DESC`

### Interface MovimentacaoHistorico Expandida

```typescript
interface MovimentacaoHistorico {
  id: string;
  createdAt: string;
  tipo: string;
  quantidade: number;
  estoqueAntes: number | null;
  estoqueDepois: number | null;
  motivo: string | null;
  // Novos campos:
  tipoAjusteId: string | null;
  tipoAjusteNome: string | null;
  localNome: string | null;
  localDestinoNome: string | null;
  transferenciaId: string | null;
}
```

### Parâmetros do Hook

Adicionar parâmetro opcional `semLimite?: boolean` para permitir buscar todo o histórico:

```typescript
export function useHistoricoMovimentacoesItem(
  itemId: string | null, 
  localId: string | null,
  semLimite?: boolean
)
```

---

## Resumo de Alterações

### Banco de Dados (Migração)

```sql
-- 1. Criar tabela tipos_ajuste_estoque
CREATE TABLE public.tipos_ajuste_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Habilitar RLS
ALTER TABLE public.tipos_ajuste_estoque ENABLE ROW LEVEL SECURITY;

-- 3. Policies
CREATE POLICY "Users can read own tipos_ajuste" 
  ON public.tipos_ajuste_estoque FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tipos_ajuste" 
  ON public.tipos_ajuste_estoque FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tipos_ajuste" 
  ON public.tipos_ajuste_estoque FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tipos_ajuste" 
  ON public.tipos_ajuste_estoque FOR DELETE 
  USING (auth.uid() = user_id);

-- 4. Adicionar coluna em estoque_movimentacoes
ALTER TABLE public.estoque_movimentacoes 
  ADD COLUMN tipo_ajuste_id UUID REFERENCES public.tipos_ajuste_estoque(id);
```

### Arquivos Frontend

| Arquivo | Tipo de Alteração |
|---------|-------------------|
| `src/components/estoque/RelatorioSaidasModal.tsx` | Scroll na lista, botão "Selecionar todos", filtro tipo ajuste condicional |
| `src/components/estoque/AjusteEstoqueModal.tsx` | Substituir motivo por select de tipo + observação opcional |
| `src/components/estoque/HistoricoMovimentacoesModal.tsx` | Estado vazio informativo, cards detalhados com mais informações |
| `src/hooks/useRelatorioSaidas.ts` | Adicionar `tipoAjusteIds` ao filtro, hook `useTiposAjusteParaFiltro` |
| `src/hooks/useEstoquePorLocalGerenciamento.ts` | Hook `useTiposAjuste`, expandir query do histórico, parâmetro `semLimite` |

---

## Critérios de Aceite

### Filtro de Modelos
- ✅ Lista rola com mouse/trackpad
- ✅ Botão "Selecionar todos" aparece quando há busca com 2+ resultados
- ✅ Contador de modelos selecionados

### Tipos de Ajuste
- ✅ Tabela `tipos_ajuste_estoque` criada com RLS
- ✅ Select obrigatório no modal Ajustar Estoque
- ✅ Observação opcional
- ✅ Bloqueia salvamento sem tipo

### Filtro no Relatório
- ✅ Aparece somente quando Tipo Saída = Ajuste
- ✅ Multi-select dos tipos cadastrados
- ✅ Query filtra por `tipo_ajuste_id`

### Histórico de Movimentações
- ✅ Estado vazio mostra período, possíveis causas e botões de ação
- ✅ Cards mostram todos os detalhes (data, tipo, quantidade, saldo, local, motivo, usuário)
- ✅ Ordenado por mais recente
- ✅ Botão "Buscar desde início" funciona

