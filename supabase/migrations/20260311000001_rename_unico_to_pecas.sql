-- Renomear o valor especial de tamanho "ÚNICO"/"UNICO" para "PEÇAS" em todo o banco de dados.
-- Afeta: estoque_itens.nome, estoque_itens.localizacao, pedido_itens.produto_nome

-- ── estoque_itens.nome ──────────────────────────────────────────────────────
-- Variante com acento: ex. "PLS Short saia frente e trás — OT2603-085-ÚNICO"
UPDATE public.estoque_itens
SET nome = REPLACE(nome, '-ÚNICO', '-PEÇAS')
WHERE nome LIKE '%-ÚNICO%';

-- Variante sem acento: ex. "-UNICO"
UPDATE public.estoque_itens
SET nome = REPLACE(nome, '-UNICO', '-PEÇAS')
WHERE nome LIKE '%-UNICO%';

-- Sufixo com " — Tamanho ÚNICO" (formato antigo que possa ter escorregado)
UPDATE public.estoque_itens
SET nome = REPLACE(nome, ' — Tamanho ÚNICO', '')
WHERE nome LIKE '% — Tamanho ÚNICO%';

UPDATE public.estoque_itens
SET nome = REPLACE(nome, ' — Tamanho UNICO', '')
WHERE nome LIKE '% — Tamanho UNICO%';

-- ── estoque_itens.localizacao (JSON texto) ──────────────────────────────────
-- campo "tamanho":"ÚNICO" → "tamanho":"PEÇAS"
-- campo "referencia":"REF-ÚNICO" → "referencia":"REF-PEÇAS"
UPDATE public.estoque_itens
SET localizacao = REPLACE(REPLACE(localizacao, '"ÚNICO"', '"PEÇAS"'), '-ÚNICO"', '-PEÇAS"')
WHERE localizacao LIKE '%ÚNICO%';

-- Variante sem acento
UPDATE public.estoque_itens
SET localizacao = REPLACE(REPLACE(localizacao, '"UNICO"', '"PEÇAS"'), '-UNICO"', '-PEÇAS"')
WHERE localizacao LIKE '%UNICO%';

-- ── pedido_itens.produto_nome ───────────────────────────────────────────────
UPDATE public.pedido_itens
SET produto_nome = REPLACE(produto_nome, '-ÚNICO', '-PEÇAS')
WHERE produto_nome LIKE '%-ÚNICO%';

UPDATE public.pedido_itens
SET produto_nome = REPLACE(produto_nome, '-UNICO', '-PEÇAS')
WHERE produto_nome LIKE '%-UNICO%';

-- ── pedido_itens.localizacao (se a coluna existir) ──────────────────────────
UPDATE public.pedido_itens
SET localizacao = REPLACE(REPLACE(localizacao, '"ÚNICO"', '"PEÇAS"'), '-ÚNICO"', '-PEÇAS"')
WHERE localizacao LIKE '%ÚNICO%';

UPDATE public.pedido_itens
SET localizacao = REPLACE(REPLACE(localizacao, '"UNICO"', '"PEÇAS"'), '-UNICO"', '-PEÇAS"')
WHERE localizacao LIKE '%UNICO%';
