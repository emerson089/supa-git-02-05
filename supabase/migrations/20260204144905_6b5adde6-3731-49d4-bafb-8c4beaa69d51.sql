-- Atualizar RPC para incluir parâmetro de observações
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

  -- Criar transferência com status PENDENTE (sem mover estoque)
  -- Incluindo observacoes no INSERT
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
$function$;