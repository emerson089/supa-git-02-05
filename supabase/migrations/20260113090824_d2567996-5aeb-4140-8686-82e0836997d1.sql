-- Criar tabela de prestadores de serviço
CREATE TABLE public.prestadores_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  etapas TEXT[] NOT NULL,
  ativo BOOLEAN DEFAULT true,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prestadores_servico ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own prestadores" ON public.prestadores_servico
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prestadores" ON public.prestadores_servico
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prestadores" ON public.prestadores_servico
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own prestadores" ON public.prestadores_servico
  FOR DELETE USING (auth.uid() = user_id);

-- Adicionar coluna checklist_aprontamento na tabela producao
ALTER TABLE public.producao ADD COLUMN IF NOT EXISTS 
  checklist_aprontamento JSONB DEFAULT '{"botao": false, "bolsa": false, "cordao": false, "tag": false}';

-- Migrar dados existentes para novas etapas
UPDATE public.producao SET processo_atual = 'Costura/Facção' WHERE processo_atual = 'Facção/Costura';
UPDATE public.producao SET processo_atual = 'Aprontamento' WHERE processo_atual = 'Acabamento';
UPDATE public.producao SET processo_atual = 'Vendas' WHERE processo_atual = 'Concluído';