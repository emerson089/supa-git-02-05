-- 1. Storage: Permitir vendedor_loja ler imagens do bucket lotes
DROP POLICY IF EXISTS "Users can read role-based lotes images" ON storage.objects;

CREATE POLICY "Users can read role-based lotes images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lotes' AND
  (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gerente'::app_role)
    OR has_role(auth.uid(), 'vendedor'::app_role)
    OR has_role(auth.uid(), 'vendedor_loja'::app_role)
  )
);

-- 2. Transferencias: Permitir vendedor_loja atualizar transferências
DROP POLICY IF EXISTS "Users can update transferencias" ON public.transferencias;

CREATE POLICY "Users can update transferencias"
ON public.transferencias FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'vendedor'::app_role)
  OR has_role(auth.uid(), 'vendedor_loja'::app_role)
);

-- 3. Transferencia_itens: Permitir vendedor_loja atualizar itens
DROP POLICY IF EXISTS "Users can update transferencia_itens" ON public.transferencia_itens;

CREATE POLICY "Users can update transferencia_itens"
ON public.transferencia_itens FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'vendedor'::app_role)
  OR has_role(auth.uid(), 'vendedor_loja'::app_role)
);