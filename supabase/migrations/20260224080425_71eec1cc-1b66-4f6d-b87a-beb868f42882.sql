
CREATE OR REPLACE FUNCTION public.rpc_ajustar_estoque_local(p_local_id uuid, p_item_id uuid, p_nova_quantidade numeric, p_user_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_estoque_atual RECORD;
  v_central_local_id UUID;
  v_diferenca NUMERIC;
  v_tipo_mov TEXT;
  v_auth_uid UUID;
  v_user_role app_role;
  v_owner_id UUID;
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

  -- Se é vendedor, validar que tem acesso ao local
  IF v_user_role = 'vendedor' THEN
    IF NOT has_location_access(v_auth_uid, p_local_id, 'adjust_stock') THEN
      RAISE EXCEPTION 'Vendedor não tem permissão para ajustar estoque deste local';
    END IF;
  END IF;

  -- Buscar o owner (dono) do local a partir de estoque_locais
  SELECT user_id INTO v_owner_id
  FROM estoque_locais
  WHERE id = p_local_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Local não encontrado';
  END IF;

  -- 1. Buscar local Central do DONO do local
  SELECT id INTO v_central_local_id
  FROM estoque_locais
  WHERE user_id = v_owner_id AND tipo = 'central';

  -- 2. Buscar estoque atual usando item_id + local_id (sem filtro user_id)
  SELECT * INTO v_estoque_atual
  FROM estoque_por_local
  WHERE item_id = p_item_id AND local_id = p_local_id;

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

  -- 4. Registrar movimentação (com o ID do vendedor para auditoria)
  INSERT INTO estoque_movimentacoes (
    user_id, item_id, local_id, tipo, quantidade, motivo,
    estoque_antes, estoque_depois
  )
  VALUES (
    v_auth_uid, p_item_id, p_local_id, v_tipo_mov, ABS(v_diferenca), p_motivo,
    v_estoque_atual.quantidade, p_nova_quantidade
  );

  -- 5. Sincronização com estoque_itens agora é automática via trigger
END;
$function$;
