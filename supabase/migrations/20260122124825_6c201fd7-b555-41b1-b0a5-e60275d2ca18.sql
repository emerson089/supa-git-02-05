-- Atualizar a função rpc_criar_transferencia para validar direção para vendedor_loja
CREATE OR REPLACE FUNCTION public.rpc_criar_transferencia(p_origem_local_id uuid, p_destino_local_id uuid, p_itens jsonb, p_user_id uuid, p_motivo text DEFAULT NULL::text)
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
  v_estoque_origem RECORD;
  v_estoque_destino RECORD;
  v_central_local_id UUID;
  v_disponivel NUMERIC;
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
  END LOOP;

  RETURN v_transferencia_id;
END;
$function$;

-- Adicionar vendedor_loja às policies de transferencias (INSERT)
DROP POLICY IF EXISTS "vendedor_loja pode inserir transferencias" ON public.transferencias;
CREATE POLICY "vendedor_loja pode inserir transferencias"
ON public.transferencias
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  has_role(auth.uid(), 'vendedor_loja'::app_role)
);

-- Adicionar vendedor_loja às policies de transferencia_itens (INSERT)
DROP POLICY IF EXISTS "vendedor_loja pode inserir transferencia_itens" ON public.transferencia_itens;
CREATE POLICY "vendedor_loja pode inserir transferencia_itens"
ON public.transferencia_itens
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  has_role(auth.uid(), 'vendedor_loja'::app_role)
);

-- Permitir vendedor_loja ler estoque_locais
DROP POLICY IF EXISTS "vendedor_loja can read estoque_locais" ON public.estoque_locais;
CREATE POLICY "vendedor_loja can read estoque_locais"
ON public.estoque_locais
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'vendedor_loja'::app_role));

-- Permitir vendedor_loja ler estoque_por_local
DROP POLICY IF EXISTS "vendedor_loja can read estoque_por_local" ON public.estoque_por_local;
CREATE POLICY "vendedor_loja can read estoque_por_local"
ON public.estoque_por_local
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'vendedor_loja'::app_role));

-- Permitir vendedor_loja ler estoque_itens (já existe policy que inclui vendedor, mas vamos adicionar vendedor_loja)
-- A policy existente já usa has_role para admin/gerente/vendedor, vamos adicionar vendedor_loja
DROP POLICY IF EXISTS "Users can read own or role-based estoque_itens" ON public.estoque_itens;
CREATE POLICY "Users can read own or role-based estoque_itens"
ON public.estoque_itens
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR 
  has_role(auth.uid(), 'vendedor'::app_role) OR
  has_role(auth.uid(), 'vendedor_loja'::app_role)
);

-- Atualizar policies de transferencias para incluir vendedor_loja no SELECT
DROP POLICY IF EXISTS "Users can read own or role-based transferencias" ON public.transferencias;
CREATE POLICY "Users can read own or role-based transferencias"
ON public.transferencias
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR 
  has_role(auth.uid(), 'vendedor'::app_role) OR
  has_role(auth.uid(), 'vendedor_loja'::app_role)
);

-- Atualizar policies de transferencia_itens para incluir vendedor_loja no SELECT
DROP POLICY IF EXISTS "Users can read own or role-based transferencia_itens" ON public.transferencia_itens;
CREATE POLICY "Users can read own or role-based transferencia_itens"
ON public.transferencia_itens
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR 
  has_role(auth.uid(), 'vendedor'::app_role) OR
  has_role(auth.uid(), 'vendedor_loja'::app_role)
);