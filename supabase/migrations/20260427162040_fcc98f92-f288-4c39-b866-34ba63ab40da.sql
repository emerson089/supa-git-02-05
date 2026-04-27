-- Remover duplicatas de grupos_comprovantes mantendo a linha mais antiga por group_whatsapp_id
DELETE FROM public.grupos_comprovantes a
USING public.grupos_comprovantes b
WHERE a.ctid < b.ctid
  AND a.group_whatsapp_id = b.group_whatsapp_id;

-- Adicionar UNIQUE constraint para impedir duplicatas futuras
ALTER TABLE public.grupos_comprovantes
ADD CONSTRAINT grupos_comprovantes_group_whatsapp_id_unique UNIQUE (group_whatsapp_id);