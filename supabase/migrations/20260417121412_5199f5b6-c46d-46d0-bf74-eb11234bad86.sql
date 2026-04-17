-- Enum de categoria
DO $$ BEGIN
  CREATE TYPE public.comprovante_categoria AS ENUM ('jeans', 'alfaiataria', 'nao_classificado');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Coluna categoria
ALTER TABLE public.comprovantes
  ADD COLUMN IF NOT EXISTS categoria public.comprovante_categoria
  NOT NULL DEFAULT 'nao_classificado';

-- Índice para os cards de totais
CREATE INDEX IF NOT EXISTS idx_comprovantes_categoria_created
  ON public.comprovantes (categoria, created_at DESC);
