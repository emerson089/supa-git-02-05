-- 1. Criar tabela tipos_ajuste_estoque
CREATE TABLE public.tipos_ajuste_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Habilitar RLS
ALTER TABLE public.tipos_ajuste_estoque ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Users can read own tipos_ajuste" 
  ON public.tipos_ajuste_estoque FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tipos_ajuste" 
  ON public.tipos_ajuste_estoque FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tipos_ajuste" 
  ON public.tipos_ajuste_estoque FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tipos_ajuste" 
  ON public.tipos_ajuste_estoque FOR DELETE 
  USING (auth.uid() = user_id);

-- 4. Adicionar coluna tipo_ajuste_id em estoque_movimentacoes
ALTER TABLE public.estoque_movimentacoes 
  ADD COLUMN tipo_ajuste_id UUID REFERENCES public.tipos_ajuste_estoque(id);