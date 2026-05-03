-- Corrigir estoque_itens para refletir apenas quantidade do Central
UPDATE estoque_itens ei
SET quantidade = COALESCE(
  (SELECT epl.quantidade 
   FROM estoque_por_local epl
   JOIN estoque_locais el ON el.id = epl.local_id
   WHERE epl.item_id = ei.id AND el.tipo = 'central'),
  ei.quantidade
),
updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM estoque_por_local epl
  JOIN estoque_locais el ON el.id = epl.local_id
  WHERE epl.item_id = ei.id AND el.tipo = 'central'
);