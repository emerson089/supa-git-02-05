-- ============================================================
-- 1. Criar tabela user_locations para vincular usuários a locais
-- ============================================================
CREATE TABLE public.user_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    local_id UUID NOT NULL REFERENCES estoque_locais(id) ON DELETE CASCADE,
    can_view BOOLEAN NOT NULL DEFAULT true,
    can_adjust_stock BOOLEAN NOT NULL DEFAULT false,
    can_edit_price BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, local_id)
);

-- Habilitar RLS
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- Policies para user_locations
CREATE POLICY "Admins can manage user_locations"
ON public.user_locations FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own locations"
ON public.user_locations FOR SELECT
USING (auth.uid() = user_id);

-- ============================================================
-- 2. Criar função helper para verificar acesso ao local
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_location_access(
    _user_id UUID, 
    _local_id UUID, 
    _permission TEXT DEFAULT 'view'
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_locations
        WHERE user_id = _user_id 
          AND local_id = _local_id
          AND (
              (_permission = 'view' AND can_view = true) OR
              (_permission = 'adjust_stock' AND can_adjust_stock = true) OR
              (_permission = 'edit_price' AND can_edit_price = true)
          )
    )
$$;

-- ============================================================
-- 3. Criar função para obter locais permitidos de um usuário
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_allowed_locations(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT local_id FROM public.user_locations
    WHERE user_id = _user_id AND can_view = true
$$;

-- ============================================================
-- 4. Ajustar policy de SELECT em estoque_por_local para vendedor
-- Vendedor só pode ver estoque dos locais permitidos
-- ============================================================
DROP POLICY IF EXISTS "vendedor can read estoque_por_local" ON public.estoque_por_local;

CREATE POLICY "vendedor can read allowed locations estoque"
ON public.estoque_por_local FOR SELECT
USING (
    has_role(auth.uid(), 'vendedor') 
    AND has_location_access(auth.uid(), local_id, 'view')
);

-- ============================================================
-- 5. Ajustar policy de UPDATE em estoque_por_local para vendedor
-- Vendedor só pode ajustar estoque dos locais permitidos
-- ============================================================
DROP POLICY IF EXISTS "Users can update own or role-based estoque_por_local" ON public.estoque_por_local;

CREATE POLICY "Users can update own estoque_por_local"
ON public.estoque_por_local FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Staff can update estoque_por_local"
ON public.estoque_por_local FOR UPDATE
USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente')
);

CREATE POLICY "vendedor can update allowed locations estoque"
ON public.estoque_por_local FOR UPDATE
USING (
    has_role(auth.uid(), 'vendedor') 
    AND has_location_access(auth.uid(), local_id, 'adjust_stock')
);

-- ============================================================
-- 6. Ajustar policies de precos_por_local para vendedor
-- Vendedor só pode gerenciar preços dos locais permitidos
-- ============================================================
DROP POLICY IF EXISTS "vendedor can read precos_por_local" ON public.precos_por_local;
DROP POLICY IF EXISTS "vendedor can insert precos_por_local" ON public.precos_por_local;
DROP POLICY IF EXISTS "vendedor can update precos_por_local" ON public.precos_por_local;
DROP POLICY IF EXISTS "vendedor can delete precos_por_local" ON public.precos_por_local;

CREATE POLICY "vendedor can read allowed locations precos"
ON public.precos_por_local FOR SELECT
USING (
    has_role(auth.uid(), 'vendedor') 
    AND has_location_access(auth.uid(), local_id, 'view')
);

CREATE POLICY "vendedor can insert allowed locations precos"
ON public.precos_por_local FOR INSERT
WITH CHECK (
    has_role(auth.uid(), 'vendedor') 
    AND has_location_access(auth.uid(), local_id, 'edit_price')
);

CREATE POLICY "vendedor can update allowed locations precos"
ON public.precos_por_local FOR UPDATE
USING (
    has_role(auth.uid(), 'vendedor') 
    AND has_location_access(auth.uid(), local_id, 'edit_price')
);

CREATE POLICY "vendedor can delete allowed locations precos"
ON public.precos_por_local FOR DELETE
USING (
    has_role(auth.uid(), 'vendedor') 
    AND has_location_access(auth.uid(), local_id, 'edit_price')
);

-- ============================================================
-- 7. Ajustar policies de estoque_movimentacoes para vendedor
-- Vendedor só pode ver/inserir movimentações dos locais permitidos
-- ============================================================
DROP POLICY IF EXISTS "vendedor can read estoque_movimentacoes" ON public.estoque_movimentacoes;
DROP POLICY IF EXISTS "vendedor can insert estoque_movimentacoes" ON public.estoque_movimentacoes;

CREATE POLICY "vendedor can read allowed locations movimentacoes"
ON public.estoque_movimentacoes FOR SELECT
USING (
    has_role(auth.uid(), 'vendedor') 
    AND has_location_access(auth.uid(), local_id, 'view')
);

CREATE POLICY "vendedor can insert allowed locations movimentacoes"
ON public.estoque_movimentacoes FOR INSERT
WITH CHECK (
    has_role(auth.uid(), 'vendedor') 
    AND has_location_access(auth.uid(), local_id, 'adjust_stock')
);

-- ============================================================
-- 8. Ajustar policy de estoque_locais para vendedor
-- Vendedor só pode ver os locais permitidos
-- ============================================================
DROP POLICY IF EXISTS "vendedor can read estoque_locais" ON public.estoque_locais;

CREATE POLICY "vendedor can read allowed estoque_locais"
ON public.estoque_locais FOR SELECT
USING (
    has_role(auth.uid(), 'vendedor') 
    AND has_location_access(auth.uid(), id, 'view')
);

-- ============================================================
-- 9. Atualizar RPC rpc_ajustar_estoque_local para validar acesso
-- ============================================================
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
AS $function$
DECLARE
  v_estoque_atual RECORD;
  v_central_local_id UUID;
  v_diferenca NUMERIC;
  v_tipo_mov TEXT;
  v_auth_uid UUID;
  v_user_role app_role;
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
END;
$function$;