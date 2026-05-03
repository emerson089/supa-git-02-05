-- =============================================================
-- FASE B: Triggers para sincronização automática e definitiva
-- =============================================================

-- B1) Trigger para manter estoque_itens.quantidade sincronizado com Central
-- Sempre que estoque_por_local for alterado para um local Central, 
-- atualiza estoque_itens.quantidade automaticamente

CREATE OR REPLACE FUNCTION public.fn_sync_estoque_itens_from_central()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_central BOOLEAN;
BEGIN
  -- Verificar se o local é do tipo 'central'
  SELECT (tipo = 'central') INTO v_is_central
  FROM estoque_locais
  WHERE id = COALESCE(NEW.local_id, OLD.local_id);

  -- Só sincronizar se for o Central
  IF v_is_central THEN
    IF TG_OP = 'DELETE' THEN
      -- Se deletar registro do Central, zerar em estoque_itens
      UPDATE estoque_itens
      SET quantidade = 0, updated_at = NOW()
      WHERE id = OLD.item_id;
    ELSE
      -- INSERT ou UPDATE: sincronizar quantidade
      UPDATE estoque_itens
      SET quantidade = NEW.quantidade, updated_at = NOW()
      WHERE id = NEW.item_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Criar trigger para INSERT/UPDATE/DELETE em estoque_por_local
DROP TRIGGER IF EXISTS trg_sync_estoque_itens_from_central ON estoque_por_local;
CREATE TRIGGER trg_sync_estoque_itens_from_central
AFTER INSERT OR UPDATE OR DELETE ON estoque_por_local
FOR EACH ROW
EXECUTE FUNCTION fn_sync_estoque_itens_from_central();

-- B2) Trigger para garantir que todo novo item tenha linha no Central
CREATE OR REPLACE FUNCTION public.fn_create_central_entry_on_new_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_central_local_id UUID;
BEGIN
  -- Buscar o local Central do user
  SELECT id INTO v_central_local_id
  FROM estoque_locais
  WHERE user_id = NEW.user_id AND tipo = 'central';

  -- Se encontrou Central e não existe registro, criar
  IF v_central_local_id IS NOT NULL THEN
    INSERT INTO estoque_por_local (user_id, item_id, local_id, quantidade, quantidade_reservada)
    VALUES (NEW.user_id, NEW.id, v_central_local_id, NEW.quantidade, 0)
    ON CONFLICT (item_id, local_id) DO UPDATE
    SET quantidade = NEW.quantidade, updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

-- Criar trigger AFTER INSERT em estoque_itens
DROP TRIGGER IF EXISTS trg_create_central_entry_on_new_item ON estoque_itens;
CREATE TRIGGER trg_create_central_entry_on_new_item
AFTER INSERT ON estoque_itens
FOR EACH ROW
EXECUTE FUNCTION fn_create_central_entry_on_new_item();

-- =============================================================
-- FASE C: Hardening das RPCs
-- =============================================================

-- C1 e C2) Corrigir rpc_ajustar_estoque_local
CREATE OR REPLACE FUNCTION public.rpc_ajustar_estoque_local(
  p_local_id uuid, 
  p_item_id uuid, 
  p_nova_quantidade numeric, 
  p_user_id uuid, 
  p_motivo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_estoque_atual RECORD;
  v_central_local_id UUID;
  v_diferenca NUMERIC;
  v_tipo_mov TEXT;
  v_auth_uid UUID;
BEGIN
  -- Validar autenticação
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  IF v_auth_uid != p_user_id THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;

  -- 1. Buscar local Central
  SELECT id INTO v_central_local_id
  FROM estoque_locais
  WHERE user_id = v_auth_uid AND tipo = 'central';

  -- 2. Buscar estoque atual
  SELECT * INTO v_estoque_atual
  FROM estoque_por_local
  WHERE item_id = p_item_id AND local_id = p_local_id AND user_id = v_auth_uid;

  IF v_estoque_atual IS NULL THEN
    RAISE EXCEPTION 'Estoque não encontrado para este item/local';
  END IF;

  v_diferenca := p_nova_quantidade - v_estoque_atual.quantidade;

  IF v_diferenca = 0 THEN
    RAISE EXCEPTION 'Quantidade não foi alterada';
  END IF;

  v_tipo_mov := CASE WHEN v_diferenca > 0 THEN 'AJUSTE_ENTRADA' ELSE 'AJUSTE_SAIDA' END;

  -- 3. Atualizar estoque
  UPDATE estoque_por_local
  SET quantidade = p_nova_quantidade, updated_at = NOW()
  WHERE id = v_estoque_atual.id;

  -- 4. Registrar movimentação
  INSERT INTO estoque_movimentacoes (
    user_id, item_id, local_id, tipo, quantidade, motivo,
    estoque_antes, estoque_depois
  )
  VALUES (
    v_auth_uid, p_item_id, p_local_id, v_tipo_mov, ABS(v_diferenca), p_motivo,
    v_estoque_atual.quantidade, p_nova_quantidade
  );

  -- 5. Sincronização com estoque_itens agora é automática via trigger
  -- Não precisa mais fazer manualmente
END;
$$;

-- C1 e C2) Corrigir rpc_criar_transferencia
CREATE OR REPLACE FUNCTION public.rpc_criar_transferencia(
  p_origem_local_id uuid, 
  p_destino_local_id uuid, 
  p_itens jsonb, 
  p_user_id uuid, 
  p_motivo text DEFAULT NULL::text
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
  v_estoque_origem RECORD;
  v_estoque_destino RECORD;
  v_central_local_id UUID;
  v_disponivel NUMERIC;
  v_auth_uid UUID;
BEGIN
  -- Validar autenticação
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  IF v_auth_uid != p_user_id THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;

  -- 1. Buscar local Central para referência
  SELECT id INTO v_central_local_id
  FROM estoque_locais
  WHERE user_id = v_auth_uid AND tipo = 'central';

  -- 2. Validar disponibilidade de TODOS os itens ANTES de fazer qualquer alteração
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_item_id := (v_item->>'item_id')::UUID;
    v_quantidade := (v_item->>'quantidade')::NUMERIC;

    SELECT * INTO v_estoque_origem
    FROM estoque_por_local
    WHERE item_id = v_item_id 
      AND local_id = p_origem_local_id 
      AND user_id = v_auth_uid;

    v_disponivel := COALESCE(v_estoque_origem.quantidade, 0) - COALESCE(v_estoque_origem.quantidade_reservada, 0);

    IF v_estoque_origem IS NULL OR v_disponivel < v_quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para item %. Disponível: %', v_item_id, COALESCE(v_disponivel, 0);
    END IF;
  END LOOP;

  -- 3. Criar registro da transferência
  INSERT INTO transferencias (
    user_id, local_origem_id, local_destino_id, 
    tipo, status, observacoes
  )
  VALUES (
    v_auth_uid, p_origem_local_id, p_destino_local_id, 
    'transferencia', 'concluida', p_motivo
  )
  RETURNING id INTO v_transferencia_id;

  -- 4. Processar cada item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_item_id := (v_item->>'item_id')::UUID;
    v_quantidade := (v_item->>'quantidade')::NUMERIC;

    -- Buscar estoques
    SELECT * INTO v_estoque_origem
    FROM estoque_por_local
    WHERE item_id = v_item_id AND local_id = p_origem_local_id AND user_id = v_auth_uid;

    SELECT * INTO v_estoque_destino
    FROM estoque_por_local
    WHERE item_id = v_item_id AND local_id = p_destino_local_id AND user_id = v_auth_uid;

    -- Inserir item da transferência
    INSERT INTO transferencia_itens (user_id, transferencia_id, item_id, quantidade_enviada)
    VALUES (v_auth_uid, v_transferencia_id, v_item_id, v_quantidade);

    -- Registrar movimentação de SAÍDA na origem
    INSERT INTO estoque_movimentacoes (
      user_id, item_id, local_id, tipo, quantidade, motivo,
      estoque_antes, estoque_depois, transferencia_id
    )
    VALUES (
      v_auth_uid, v_item_id, p_origem_local_id, 'TRANSFERENCIA', v_quantidade,
      COALESCE(p_motivo, 'Transferência para outro local'),
      v_estoque_origem.quantidade, v_estoque_origem.quantidade - v_quantidade,
      v_transferencia_id
    );

    -- Subtrair da origem
    UPDATE estoque_por_local
    SET quantidade = quantidade - v_quantidade, updated_at = NOW()
    WHERE id = v_estoque_origem.id;

    -- Registrar movimentação de ENTRADA no destino
    INSERT INTO estoque_movimentacoes (
      user_id, item_id, local_id, tipo, quantidade, motivo,
      estoque_antes, estoque_depois, transferencia_id
    )
    VALUES (
      v_auth_uid, v_item_id, p_destino_local_id, 'TRANSFERENCIA', v_quantidade,
      'Transferência do local de origem',
      COALESCE(v_estoque_destino.quantidade, 0), 
      COALESCE(v_estoque_destino.quantidade, 0) + v_quantidade,
      v_transferencia_id
    );

    -- Adicionar no destino (INSERT ou UPDATE)
    IF v_estoque_destino IS NOT NULL THEN
      UPDATE estoque_por_local
      SET quantidade = quantidade + v_quantidade, updated_at = NOW()
      WHERE id = v_estoque_destino.id;
    ELSE
      INSERT INTO estoque_por_local (user_id, item_id, local_id, quantidade, quantidade_reservada)
      VALUES (v_auth_uid, v_item_id, p_destino_local_id, v_quantidade, 0);
    END IF;

    -- Sincronização com estoque_itens agora é automática via trigger
    -- Não precisa mais fazer manualmente
  END LOOP;

  RETURN v_transferencia_id;
END;
$$;

-- =============================================================
-- FASE D: Habilitar Realtime para estoque_por_local
-- =============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.estoque_por_local;