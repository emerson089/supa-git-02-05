-- Renomear o valor especial de tamanho "SORTIDO" para "PEÇAS" em todo o banco de dados.
-- Afeta: estoque_itens.nome, estoque_itens.localizacao, pedido_itens.produto_nome

-- 1. Atualizar nomes dos itens de estoque (ex: "Calça CA2 — CA2-SORTIDO" → "Calça CA2 — CA2-PEÇAS")
UPDATE public.estoque_itens
SET nome = REPLACE(nome, '-SORTIDO', '-PEÇAS')
WHERE nome LIKE '%-SORTIDO';

-- 2. Atualizar localizacao JSON dos itens de estoque
--    Cobre: campo "tamanho":"SORTIDO" e campo "referencia":"REF-SORTIDO"
UPDATE public.estoque_itens
SET localizacao = REPLACE(REPLACE(localizacao, '"SORTIDO"', '"PEÇAS"'), '-SORTIDO"', '-PEÇAS"')
WHERE localizacao LIKE '%SORTIDO%';

-- 3. Atualizar produto_nome nos itens de pedido
UPDATE public.pedido_itens
SET produto_nome = REPLACE(produto_nome, '-SORTIDO', '-PEÇAS')
WHERE produto_nome LIKE '%-SORTIDO%';
