-- Tabela para armazenar custos padrão (templates)
CREATE TABLE public.custos_padrao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor_unitario NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para busca por usuário
CREATE INDEX idx_custos_padrao_user_id ON public.custos_padrao(user_id);

-- Enable Row Level Security
ALTER TABLE public.custos_padrao ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can read own custos_padrao"
ON public.custos_padrao
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own custos_padrao"
ON public.custos_padrao
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own custos_padrao"
ON public.custos_padrao
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own custos_padrao"
ON public.custos_padrao
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_custos_padrao_updated_at
BEFORE UPDATE ON public.custos_padrao
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();