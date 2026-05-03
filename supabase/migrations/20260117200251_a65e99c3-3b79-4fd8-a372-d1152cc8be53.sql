-- =============================================
-- RPC: rpc_criar_transferencia
-- Cria transferência atômica entre locais
-- Valida disponibilidade, move estoque, registra movimentações
-- Se Central for afetado, sincroniza estoque_itens.quantidade
-- =============================================
CREATE OR REPLACE FUNCTION rpc_criar_transferencia(
  p_origem_local_id UUID,
  p_destino_local_id UUID,
  p_itens JSONB,
  p_user_id UUID,
  p_motivo TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
BEGIN
  -- 1. Buscar local Central para sincronização
  SELECT id INTO v_central_local_id
  FROM estoque_locais
  WHERE user_id = p_user_id AND tipo = 'central';

  -- 2. Validar disponibilidade de TODOS os itens ANTES de fazer qualquer alteração
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_item_id := (v_item->>'item_id')::UUID;
    v_quantidade := (v_item->>'quantidade')::NUMERIC;

    SELECT * INTO v_estoque_origem
    FROM estoque_por_local
    WHERE item_id = v_item_id 
      AND local_id = p_origem_local_id 
      AND user_id = p_user_id;

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
    p_user_id, p_origem_local_id, p_destino_local_id, 
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
    WHERE item_id = v_item_id AND local_id = p_origem_local_id AND user_id = p_user_id;

    SELECT * INTO v_estoque_destino
    FROM estoque_por_local
    WHERE item_id = v_item_id AND local_id = p_destino_local_id AND user_id = p_user_id;

    -- Inserir item da transferência
    INSERT INTO transferencia_itens (user_id, transferencia_id, item_id, quantidade_enviada)
    VALUES (p_user_id, v_transferencia_id, v_item_id, v_quantidade);

    -- Registrar movimentação de SAÍDA na origem
    INSERT INTO estoque_movimentacoes (
      user_id, item_id, local_id, tipo, quantidade, motivo,
      estoque_antes, estoque_depois, transferencia_id
    )
    VALUES (
      p_user_id, v_item_id, p_origem_local_id, 'TRANSFERENCIA', v_quantidade,
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
      p_user_id, v_item_id, p_destino_local_id, 'TRANSFERENCIA', v_quantidade,
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
      VALUES (p_user_id, v_item_id, p_destino_local_id, v_quantidade, 0);
    END IF;

    -- Se o Central foi afetado (origem ou destino), sincronizar estoque_itens
    IF p_origem_local_id = v_central_local_id OR p_destino_local_id = v_central_local_id THEN
      UPDATE estoque_itens
      SET quantidade = (
        SELECT COALESCE(epl.quantidade, 0) 
        FROM estoque_por_local epl
        WHERE epl.item_id = v_item_id AND epl.local_id = v_central_local_id
      ),
      updated_at = NOW()
      WHERE id = v_item_id;
    END IF;
  END LOOP;

  RETURN v_transferencia_id;
END;
$$;

-- =============================================
-- RPC: rpc_ajustar_estoque_local
-- Ajusta estoque de forma atômica em um local
-- Registra movimentação e sincroniza estoque_itens se for Central
-- =============================================
CREATE OR REPLACE FUNCTION rpc_ajustar_estoque_local(
  p_local_id UUID,
  p_item_id UUID,
  p_nova_quantidade NUMERIC,
  p_user_id UUID,
  p_motivo TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estoque_atual RECORD;
  v_central_local_id UUID;
  v_diferenca NUMERIC;
  v_tipo_mov TEXT;
BEGIN
  -- 1. Buscar local Central
  SELECT id INTO v_central_local_id
  FROM estoque_locais
  WHERE user_id = p_user_id AND tipo = 'central';

  -- 2. Buscar estoque atual
  SELECT * INTO v_estoque_atual
  FROM estoque_por_local
  WHERE item_id = p_item_id AND local_id = p_local_id AND user_id = p_user_id;

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
    p_user_id, p_item_id, p_local_id, v_tipo_mov, ABS(v_diferenca), p_motivo,
    v_estoque_atual.quantidade, p_nova_quantidade
  );

  -- 5. Se afetou o Central, sincronizar estoque_itens
  IF p_local_id = v_central_local_id THEN
    UPDATE estoque_itens
    SET quantidade = p_nova_quantidade, updated_at = NOW()
    WHERE id = p_item_id;
  END IF;
END;
$$;

-- =============================================
-- Atualizar constraint de tipos de movimentação
-- para incluir TRANSFERENCIA e AJUSTE_* types
-- =============================================
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
  'ESTORNO_FEIRA'::text,
  'TRANSFERENCIA'::text,
  'AJUSTE_ENTRADA'::text,
  'AJUSTE_SAIDA'::text
]));