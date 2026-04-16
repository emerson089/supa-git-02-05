
-- Create enum for comprovante status
DO $$ BEGIN
  CREATE TYPE comprovante_status AS ENUM ('confirmado', 'pendente_revisao', 'rejeitado');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create comprovantes table
CREATE TABLE IF NOT EXISTS public.comprovantes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  valor NUMERIC,
  data_pagamento TIMESTAMPTZ,
  nome_pagador TEXT,
  banco_origem TEXT,
  tipo_pagamento TEXT,
  chave_pix TEXT,
  imagem_url TEXT NOT NULL,
  dados_brutos JSONB,
  status comprovante_status NOT NULL DEFAULT 'pendente_revisao',
  grupo_whatsapp TEXT,
  numero_remetente TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.comprovantes ENABLE ROW LEVEL SECURITY;

-- RLS policies: admin and gerente can manage
CREATE POLICY "Admin can manage comprovantes"
  ON public.comprovantes FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gerente can view comprovantes"
  ON public.comprovantes FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'gerente'::app_role));

CREATE POLICY "Gerente can update comprovantes"
  ON public.comprovantes FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'gerente'::app_role));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comprovantes_status ON public.comprovantes (status);
CREATE INDEX IF NOT EXISTS idx_comprovantes_created_at ON public.comprovantes (created_at DESC);

-- Updated_at trigger
CREATE TRIGGER update_comprovantes_updated_at
  BEFORE UPDATE ON public.comprovantes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
