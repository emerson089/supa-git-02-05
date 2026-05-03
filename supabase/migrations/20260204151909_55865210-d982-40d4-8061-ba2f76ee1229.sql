-- Fix transferencias status: use 'em_andamento' instead of 'pendente'
-- The CHECK constraint only allows: em_andamento, concluida, cancelada, estornada

-- 1. Replace rpc_criar_transferencia to use 'em_andamento'
CREATE OR REPLACE FUNCTION public.rpc_criar_transferencia(
  p_origem_local_id uuid, 
  p_destino_local_id uuid, 
  p_itens jsonb, 
  p_user_id uuid, 
  p_motivo text DEFAULT NULL::text,
  p_observacoes text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_transferencia_id UUID;
  v_item JSONB;
  v_item_id UUID;
  v_quantidade NUMERIC;
  v_auth_uid UUID;
  v_user_role app_role;
  v_origem_tipo TEXT;
  v_destino_tipo TEXT;
BEGIN
  -- Validar autenticação
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  IF v_auth_uid != p_user_id THEN
    RAISE EXCEPTION 'Usuário não autorizado';
  END IF;

  -- Verificar role do usuário
  SELECT role INTO v_user_role FROM user_roles WHERE user_id = v_auth_uid;
  
  -- Se é vendedor_loja, validar que só pode transferir de loja para central
  IF v_user_role = 'vendedor_loja' THEN
    SELECT tipo INTO v_origem_tipo FROM estoque_locais WHERE id = p_origem_local_id;
    SELECT tipo INTO v_destino_tipo FROM estoque_locais WHERE id = p_destino_local_id;
    
    IF v_origem_tipo != 'loja' OR v_destino_tipo != 'central' THEN
      RAISE EXCEPTION 'Vendedor Loja só pode transferir da Loja para o Estoque Central';
    END IF;
  END IF;

  -- Criar transferência com status EM_ANDAMENTO (válido no CHECK constraint)
  INSERT INTO transferencias (
    user_id, local_origem_id, local_destino_id, 
    tipo, status, motivo, observacoes
  )
  VALUES (
    v_auth_uid, p_origem_local_id, p_destino_local_id, 
    'transferencia', 'em_andamento', p_motivo, p_observacoes
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
$function$;

-- 2. Replace rpc_concluir_transferencia to check 'em_andamento'
CREATE OR REPLACE FUNCTION public.rpc_concluir_transferencia(p_transferencia_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  
  -- Verificar se está em_andamento (não mais 'pendente')
  IF v_transferencia.status != 'em_andamento' THEN
    RAISE EXCEPTION 'Transferência não está em andamento. Status atual: %', v_transferencia.status;
  END IF;

  -- Validar disponibilidade de TODOS os itens antes de mover
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
$function$;

-- 3. Replace rpc_cancelar_transferencia to check 'em_andamento'
CREATE OR REPLACE FUNCTION public.rpc_cancelar_transferencia(p_transferencia_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  
  -- Verificar se está em_andamento (não mais 'pendente')
  IF v_transferencia.status != 'em_andamento' THEN
    RAISE EXCEPTION 'Apenas transferências em andamento podem ser canceladas';
  END IF;

  -- Atualizar status para cancelada (sem mover estoque)
  UPDATE transferencias 
  SET status = 'cancelada',
      concluido_por = v_auth_uid,
      data_conclusao = NOW()
  WHERE id = p_transferencia_id;
END;
$function$;