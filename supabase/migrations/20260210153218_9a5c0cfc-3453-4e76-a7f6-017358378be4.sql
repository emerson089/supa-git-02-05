ALTER TABLE tipos_ajuste_estoque ADD COLUMN conta_como_venda BOOLEAN DEFAULT false;
UPDATE tipos_ajuste_estoque SET conta_como_venda = true WHERE nome ILIKE '%venda%';