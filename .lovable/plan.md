

## Plano: Evolução do Módulo de Transferências

### Visão Geral

Este plano implementa 4 melhorias no módulo de Transferências:
1. Modal de Detalhes da Transferência
2. Fluxo de Status (Pendente → Concluída / Cancelada)
3. Campo obrigatório de Motivo
4. Filtros avançados (período, origem/destino, status, motivo)

---

### 1. Alterações no Banco de Dados

#### 1.1 Adicionar colunas à tabela `transferencias`

```sql
-- Adicionar campo de motivo da transferência
ALTER TABLE transferencias ADD COLUMN IF NOT EXISTS motivo text;

-- Adicionar campo para quem concluiu/cancelou
ALTER TABLE transferencias ADD COLUMN IF NOT EXISTS concluido_por uuid REFERENCES auth.users(id);

-- Adicionar data de conclusão
ALTER TABLE transferencias ADD COLUMN IF NOT EXISTS data_conclusao timestamp with time zone;
```

#### 1.2 Criar enum para motivos (constraint check)

```sql
-- Garantir valores válidos para motivo
ALTER TABLE transferencias ADD CONSTRAINT transferencias_motivo_check 
CHECK (motivo IS NULL OR motivo IN ('feira', 'reposicao', 'ajuste', 'devolucao'));
```

---

### 2. Modificar RPC `rpc_criar_transferencia`

Atualizar a função para:
- Criar transferência com status `pendente` (não mais `concluida`)
- **NÃO** mover estoque na criação
- Salvar o motivo no campo `motivo`

```sql
CREATE OR REPLACE FUNCTION public.rpc_criar_transferencia(
  p_origem_local_id uuid, 
  p_destino_local_id uuid, 
  p_itens jsonb, 
  p_user_id uuid, 
  p_motivo text DEFAULT NULL,
  p_observacoes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_transferencia_id UUID;
  v_item JSONB;
  v_item_id UUID;
  v_quantidade NUMERIC;
  v_auth_uid UUID;
BEGIN
  -- Validar autenticação
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL OR v_auth_uid != p_user_id THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;

  -- Criar transferência com status PENDENTE (sem mover estoque)
  INSERT INTO transferencias (
    user_id, local_origem_id, local_destino_id, 
    tipo, status, motivo, observacoes
  )
  VALUES (
    v_auth_uid, p_origem_local_id, p_destino_local_id, 
    'transferencia', 'pendente', p_motivo, p_observacoes
  )
  RETURNING id INTO v_transferencia_id;

  -- Inserir itens (sem mover estoque ainda)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_item_id := (v_item->>'item_id')::UUID;
    v_quantidade := (v_item->>'quantidade')::NUMERIC;

    INSERT INTO transferencia_itens (user_id, transferencia_id, item_id, quantidade_enviada)
    VALUES (v_auth_uid, v_transferencia_id, v_item_id, v_quantidade);
  END LOOP;

  RETURN v_transferencia_id;
END;
$$;
```

---

### 3. Nova RPC `rpc_concluir_transferencia`

Esta função:
- Valida estoque disponível
- Move estoque atomicamente
- Registra movimentações
- Atualiza status para `concluida`

```sql
CREATE OR REPLACE FUNCTION public.rpc_concluir_transferencia(
  p_transferencia_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_transferencia RECORD;
  v_item RECORD;
  v_estoque_origem RECORD;
  v_estoque_destino RECORD;
  v_disponivel NUMERIC;
  v_auth_uid UUID;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Buscar transferência
  SELECT * INTO v_transferencia FROM transferencias 
  WHERE id = p_transferencia_id;
  
  IF v_transferencia IS NULL THEN
    RAISE EXCEPTION 'Transferência não encontrada';
  END IF;
  
  IF v_transferencia.status != 'pendente' THEN
    RAISE EXCEPTION 'Transferência não está pendente. Status atual: %', v_transferencia.status;
  END IF;

  -- Validar disponibilidade de TODOS os itens
  FOR v_item IN 
    SELECT * FROM transferencia_itens WHERE transferencia_id = p_transferencia_id
  LOOP
    SELECT * INTO v_estoque_origem
    FROM estoque_por_local
    WHERE item_id = v_item.item_id 
      AND local_id = v_transferencia.local_origem_id;

    v_disponivel := COALESCE(v_estoque_origem.quantidade, 0) - COALESCE(v_estoque_origem.quantidade_reservada, 0);

    IF v_disponivel < v_item.quantidade_enviada THEN
      RAISE EXCEPTION 'Estoque insuficiente para item %. Disponível: %, Necessário: %', 
        v_item.item_id, v_disponivel, v_item.quantidade_enviada;
    END IF;
  END LOOP;

  -- Mover estoque de cada item
  FOR v_item IN 
    SELECT * FROM transferencia_itens WHERE transferencia_id = p_transferencia_id
  LOOP
    SELECT * INTO v_estoque_origem
    FROM estoque_por_local
    WHERE item_id = v_item.item_id AND local_id = v_transferencia.local_origem_id;

    SELECT * INTO v_estoque_destino
    FROM estoque_por_local
    WHERE item_id = v_item.item_id AND local_id = v_transferencia.local_destino_id;

    -- Registrar saída na origem
    INSERT INTO estoque_movimentacoes (
      user_id, item_id, local_id, tipo, quantidade, motivo,
      estoque_antes, estoque_depois, transferencia_id
    )
    VALUES (
      v_auth_uid, v_item.item_id, v_transferencia.local_origem_id, 
      'TRANSFERENCIA', v_item.quantidade_enviada,
      'Saída por transferência',
      v_estoque_origem.quantidade, 
      v_estoque_origem.quantidade - v_item.quantidade_enviada,
      p_transferencia_id
    );

    -- Subtrair da origem
    UPDATE estoque_por_local
    SET quantidade = quantidade - v_item.quantidade_enviada, updated_at = NOW()
    WHERE id = v_estoque_origem.id;

    -- Registrar entrada no destino
    INSERT INTO estoque_movimentacoes (
      user_id, item_id, local_id, tipo, quantidade, motivo,
      estoque_antes, estoque_depois, transferencia_id
    )
    VALUES (
      v_auth_uid, v_item.item_id, v_transferencia.local_destino_id, 
      'TRANSFERENCIA', v_item.quantidade_enviada,
      'Entrada por transferência',
      COALESCE(v_estoque_destino.quantidade, 0), 
      COALESCE(v_estoque_destino.quantidade, 0) + v_item.quantidade_enviada,
      p_transferencia_id
    );

    -- Adicionar no destino
    IF v_estoque_destino IS NOT NULL THEN
      UPDATE estoque_por_local
      SET quantidade = quantidade + v_item.quantidade_enviada, updated_at = NOW()
      WHERE id = v_estoque_destino.id;
    ELSE
      INSERT INTO estoque_por_local (user_id, item_id, local_id, quantidade, quantidade_reservada)
      VALUES (v_transferencia.user_id, v_item.item_id, v_transferencia.local_destino_id, v_item.quantidade_enviada, 0);
    END IF;
  END LOOP;

  -- Atualizar status para concluída
  UPDATE transferencias 
  SET status = 'concluida', 
      concluido_por = v_auth_uid,
      data_conclusao = NOW(),
      data_retorno = NOW()
  WHERE id = p_transferencia_id;
END;
$$;
```

---

### 4. Nova RPC `rpc_cancelar_transferencia`

```sql
CREATE OR REPLACE FUNCTION public.rpc_cancelar_transferencia(
  p_transferencia_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_transferencia RECORD;
  v_auth_uid UUID;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_transferencia FROM transferencias WHERE id = p_transferencia_id;
  
  IF v_transferencia IS NULL THEN
    RAISE EXCEPTION 'Transferência não encontrada';
  END IF;
  
  IF v_transferencia.status != 'pendente' THEN
    RAISE EXCEPTION 'Apenas transferências pendentes podem ser canceladas';
  END IF;

  -- Atualizar status para cancelada (sem mover estoque)
  UPDATE transferencias 
  SET status = 'cancelada',
      concluido_por = v_auth_uid,
      data_conclusao = NOW()
  WHERE id = p_transferencia_id;
END;
$$;
```

---

### 5. Novos Componentes Frontend

#### 5.1 `src/components/transferencias/DetalhesTransferenciaModal.tsx`

Modal que exibe:
- ID/código da transferência
- Status com badge colorido (Pendente=amarelo, Concluída=verde, Cancelada=vermelho)
- Origem → Destino
- Datas (criação, conclusão)
- Usuário responsável (nome + role via profiles/user_roles)
- Motivo (Feira/Reposição/Ajuste/Devolução)
- Observação
- Tabela de itens: Modelo, Quantidade
- Ações (editar observação/motivo, Concluir, Cancelar) - somente se pendente

#### 5.2 `src/components/transferencias/FiltrosTransferencias.tsx`

Componente com:
- Select de período (Hoje, Últimos 7 dias, Últimos 30 dias, Personalizado)
- Calendário para datas customizadas
- Select de Origem (todos os locais)
- Select de Destino (todos os locais)
- Select de Status (Todos, Pendente, Concluída, Cancelada)
- Select de Motivo (Todos, Feira, Reposição, Ajuste, Devolução)
- Botões Aplicar/Limpar

---

### 6. Modificações em Arquivos Existentes

#### 6.1 `src/hooks/useTransferencias.ts`

Adicionar:
- Interface `Transferencia` com novos campos: `motivo`, `concluidoPor`, `dataConclusao`
- Hook `useConcluirTransferencia` (chama RPC)
- Hook `useCancelarTransferencia` (chama RPC)
- Hook `useAtualizarTransferencia` (editar observação/motivo)
- Hook `useTransferenciasFiltradas` (aceita filtros como parâmetro)
- Modificar `useCriarTransferencia` para enviar `motivo`

#### 6.2 `src/pages/Transferencias.tsx`

- Adicionar estado para filtros
- Adicionar estado para modal de detalhes
- Integrar componente `FiltrosTransferencias`
- Na lista, ao clicar em um card, abrir `DetalhesTransferenciaModal`
- Mostrar badge de status na lista com cores
- Mostrar motivo na lista (como linha secundária)
- Campo obrigatório de motivo no modal "Nova Transferência"

---

### 7. Fluxo de Criação Atualizado

| Passo | Ação | Status |
|-------|------|--------|
| 1 | Usuário seleciona origem, destino, itens, motivo | - |
| 2 | Clica "Criar Transferência" | `pendente` |
| 3 | Transferência aparece na lista com badge amarelo | `pendente` |
| 4 | Usuário clica na transferência → abre modal | - |
| 5a | Clica "Concluir" → valida estoque → move itens | `concluida` |
| 5b | Clica "Cancelar" → não move nada | `cancelada` |

---

### 8. Estrutura Visual

```text
+------------------------------------------+
| TRANSFERÊNCIAS                    [+ Nova] |
+------------------------------------------+
| Filtros:                                   |
| [Período v] [Origem v] [Destino v]        |
| [Status v]  [Motivo v] [Aplicar] [Limpar] |
+------------------------------------------+
| Lista:                                     |
| +--------------------------------------+ |
| | ● PENDENTE          28/01 às 14:30  | |
| | Central → Loja Parque               | |
| | Motivo: Reposição                   | |
| +--------------------------------------+ |
| +--------------------------------------+ |
| | ✓ CONCLUÍDA         27/01 às 10:15  | |
| | Central → Loja Parque               | |
| | Motivo: Feira                       | |
| +--------------------------------------+ |
+------------------------------------------+
```

---

### 9. Modal de Detalhes

```text
+--------------------------------------------------+
| Detalhes da Transferência           [X]          |
+--------------------------------------------------+
| ID: 3d8949ab-1693                                |
| Status: ● PENDENTE                               |
|                                                  |
| Origem: Estoque Central                          |
| Destino: Loja Parque das Feiras                  |
|                                                  |
| Criado em: 28/01/2026 às 14:30                   |
| Por: João Silva (Gerente)                        |
|                                                  |
| Motivo: [Reposição v]  (editável se pendente)    |
| Observação: [_________________] (editável)       |
|                                                  |
| +----------------------------------------------+ |
| | Produto          | Quantidade                | |
| |------------------+---------------------------| |
| | Short Saia 164   | 10 peças                  | |
| | Calça Jeans 285  | 5 peças                   | |
| +----------------------------------------------+ |
|                                                  |
| [Cancelar Transferência]  [Concluir Transferência]|
+--------------------------------------------------+
```

---

### 10. Resumo dos Arquivos

| Arquivo | Ação |
|---------|------|
| Migração SQL | Adicionar colunas e funções RPC |
| `src/hooks/useTransferencias.ts` | Adicionar hooks para concluir, cancelar, filtrar |
| `src/pages/Transferencias.tsx` | Integrar filtros, modal de detalhes, campo motivo |
| `src/components/transferencias/DetalhesTransferenciaModal.tsx` | **Novo** - Modal de detalhes |
| `src/components/transferencias/FiltrosTransferencias.tsx` | **Novo** - Componente de filtros |

---

### 11. Considerações de Segurança

- RPCs usam `SECURITY DEFINER` com validação de `auth.uid()`
- Apenas o criador ou roles autorizadas podem concluir/cancelar
- Validação atômica de estoque antes de movimentar
- RLS policies existentes serão mantidas

