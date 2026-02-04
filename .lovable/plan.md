

## Plano: Corrigir Erro de Constraint na Transferência

### Problema Identificado

O modal de transferência permite texto livre no campo "Motivo", mas a tabela `transferencias` tem um CHECK constraint que só permite:
- `NULL`
- `'feira'`
- `'reposicao'`
- `'ajuste'`
- `'devolucao'`

Quando o usuário digita "envio loja", a RPC falha com `transferencias_motivo_check`.

---

### Solução

Separar os campos em:
1. **Motivo** (obrigatório) - Dropdown com valores válidos
2. **Observações** (opcional) - Campo de texto livre

---

### Alterações

#### 1. Atualizar RPC `rpc_criar_transferencia`

Adicionar parâmetro `p_observacoes` e incluir no INSERT:

```sql
-- Atualizar função para incluir observações
CREATE OR REPLACE FUNCTION public.rpc_criar_transferencia(
  p_origem_local_id uuid, 
  p_destino_local_id uuid, 
  p_itens jsonb, 
  p_user_id uuid, 
  p_motivo text DEFAULT NULL::text,
  p_observacoes text DEFAULT NULL::text  -- NOVO parâmetro
)
-- ...
INSERT INTO transferencias (
  user_id, local_origem_id, local_destino_id, 
  tipo, status, motivo, observacoes  -- Adicionar observacoes
)
VALUES (
  v_auth_uid, p_origem_local_id, p_destino_local_id, 
  'transferencia', 'pendente', p_motivo, p_observacoes
)
```

#### 2. Atualizar Modal `AdicionarProdutoLocalModal.tsx`

**Substituir campo de texto por:**
- Dropdown de Motivo com opções:
  - `reposicao` → "Reposição"
  - `feira` → "Feira"
  - `ajuste` → "Ajuste"
  - `devolucao` → "Devolução"
- Campo de texto para Observações (opcional)

```typescript
// Estados
const [motivo, setMotivo] = useState<string>('reposicao');
const [observacoes, setObservacoes] = useState('');

// Opções do dropdown
const MOTIVOS_TRANSFERENCIA = [
  { value: 'reposicao', label: 'Reposição' },
  { value: 'feira', label: 'Feira' },
  { value: 'ajuste', label: 'Ajuste' },
  { value: 'devolucao', label: 'Devolução' },
];

// Na chamada
await transferirProduto.mutateAsync({
  itemId: produtoSelecionado.id,
  localId: localId,
  quantidade: qtd,
  motivo: motivo,  // Valor do enum
  observacoes: observacoes.trim() || undefined,
});
```

#### 3. Atualizar Hook `useAdicionarProdutoLocal`

Modificar a interface e chamada RPC:

```typescript
interface AdicionarProdutoParams {
  itemId: string;
  localId: string;
  quantidade: number;
  motivo: string;  // Agora é enum
  observacoes?: string;  // Novo campo
}

// Na chamada RPC
const { data, error } = await supabase.rpc('rpc_criar_transferencia', {
  p_origem_local_id: localCentral.id,
  p_destino_local_id: localId,
  p_itens: itensJson,
  p_user_id: user.id,
  p_motivo: motivo || 'reposicao',  // Valor do enum
  p_observacoes: observacoes || null  // Texto livre
});
```

---

### UI do Modal (Atualizada)

```text
┌─────────────────────────────────────────┐
│  Central → Loja Parque das Feiras       │
├─────────────────────────────────────────┤
│  [Busca de produto...]                  │
│                                         │
│  PRODUTO SELECIONADO                    │
│  ┌─────────────────────────────────┐    │
│  │ [img] Macaquinho estampa chic   │    │
│  │       Central: 50 | Local: 13   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Quantidade a Transferir *              │
│  ┌────────────────┐                     │
│  │ 7              │ / 50 disp.          │
│  └────────────────┘                     │
│                                         │
│  Motivo *                               │
│  ┌────────────────────────────────┐     │
│  │ Reposição              ▼       │     │
│  └────────────────────────────────┘     │
│                                         │
│  Observações (opcional)                 │
│  ┌────────────────────────────────┐     │
│  │ Envio para loja parque...      │     │
│  └────────────────────────────────┘     │
│                                         │
│  [Cancelar]  [→ Transferir]             │
└─────────────────────────────────────────┘
```

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/` | Nova migration para atualizar RPC |
| `src/components/estoque/AdicionarProdutoLocalModal.tsx` | Adicionar dropdown de motivo e campo de observações |
| `src/hooks/useEstoquePorLocalGerenciamento.ts` | Atualizar interface e chamada RPC |

---

### Comportamento Esperado

1. O dropdown mostra "Reposição" como padrão
2. O usuário pode digitar observações livremente
3. A transferência é criada com `motivo='reposicao'` e `observacoes='Envio para loja...'`
4. Nenhum erro de constraint

