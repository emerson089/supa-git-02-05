-- Adicionar colunas de snapshot em transferencia_itens
-- Assim o histórico da feira fica preservado mesmo que o item de estoque seja excluído

ALTER TABLE public.transferencia_itens
  ADD COLUMN IF NOT EXISTS nome_produto TEXT,
  ADD COLUMN IF NOT EXISTS imagem_url_produto TEXT;

-- Preencher snapshots para registros existentes (usa JOIN com estoque_itens)
UPDATE public.transferencia_itens ti
SET
  nome_produto = ei.nome,
  imagem_url_produto = ei.imagem_url
FROM public.estoque_itens ei
WHERE ti.item_id = ei.id
  AND ti.nome_produto IS NULL;

-- Alterar FK de item_id para ON DELETE SET NULL (preserva o histórico)
ALTER TABLE public.transferencia_itens
  ALTER COLUMN item_id DROP NOT NULL;

ALTER TABLE public.transferencia_itens
  DROP CONSTRAINT transferencia_itens_item_id_fkey;

ALTER TABLE public.transferencia_itens
  ADD CONSTRAINT transferencia_itens_item_id_fkey
  FOREIGN KEY (item_id)
  REFERENCES public.estoque_itens(id)
  ON DELETE SET NULL;
