ALTER TABLE public.pedidos 
ADD COLUMN IF NOT EXISTS infinitepay_link text,
ADD COLUMN IF NOT EXISTS infinitepay_nsu text;