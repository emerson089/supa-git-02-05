CREATE TYPE comprovante_status AS ENUM ('confirmado', 'pendente_revisao', 'rejeitado');

CREATE TABLE public.comprovantes (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    valor numeric,
    data_pagamento timestamp with time zone,
    nome_pagador text,
    banco_origem text,
    tipo_pagamento text,
    chave_pix text,
    imagem_url text NOT NULL,
    dados_brutos jsonb,
    status comprovante_status DEFAULT 'pendente_revisao'::comprovante_status NOT NULL,
    grupo_whatsapp text,
    numero_remetente text,
    observacoes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Trigger para updated_at automático
CREATE TRIGGER update_comprovantes_updated_at 
BEFORE UPDATE ON public.comprovantes 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.comprovantes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins e Gerentes podem gerenciar comprovantes"
ON public.comprovantes FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente'));

-- Index para facilitar buscas
CREATE INDEX idx_comprovantes_status ON public.comprovantes USING btree (status);
CREATE INDEX idx_comprovantes_created_at ON public.comprovantes USING btree (created_at);
