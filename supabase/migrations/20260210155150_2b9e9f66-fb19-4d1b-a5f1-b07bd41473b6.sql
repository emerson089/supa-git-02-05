
-- Inserir novos tipos para todos os usuarios existentes
INSERT INTO tipos_ajuste_estoque (user_id, nome, ativo, conta_como_venda)
SELECT DISTINCT user_id, 'Ajuste de estoque', true, false
FROM tipos_ajuste_estoque
ON CONFLICT (user_id, nome) DO NOTHING;

INSERT INTO tipos_ajuste_estoque (user_id, nome, ativo, conta_como_venda)
SELECT DISTINCT user_id, 'Devolução para estoque central', true, false
FROM tipos_ajuste_estoque
ON CONFLICT (user_id, nome) DO NOTHING;

-- Desativar tipos em uso
UPDATE tipos_ajuste_estoque SET ativo = false
WHERE nome IN ('Inventário / Conferência física', 'Erro de lançamento');

-- Excluir tipos sem uso (Bonificacao / Brinde)
DELETE FROM tipos_ajuste_estoque
WHERE nome = 'Bonificação / Brinde'
AND id NOT IN (SELECT DISTINCT tipo_ajuste_id FROM estoque_movimentacoes WHERE tipo_ajuste_id IS NOT NULL);
