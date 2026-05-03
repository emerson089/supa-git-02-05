-- Parte 1: timestamp de quando o lote entrou na etapa atual
-- Usado para calcular tempo na etapa com precisão (updated_at era impreciso)
ALTER TABLE public.producao
ADD COLUMN IF NOT EXISTS etapa_iniciada_em TIMESTAMPTZ DEFAULT now();

-- Backfill: para lotes existentes usa updated_at como aproximação
UPDATE public.producao
SET etapa_iniciada_em = updated_at
WHERE etapa_iniciada_em IS NULL;
