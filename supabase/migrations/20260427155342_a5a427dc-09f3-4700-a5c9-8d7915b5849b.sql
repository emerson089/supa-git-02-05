-- ============================================================
-- 1. Tabela: grupos_comprovantes
-- ============================================================
CREATE TABLE public.grupos_comprovantes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  group_whatsapp_id text NOT NULL,
  nome text NOT NULL,
  emoji text NOT NULL DEFAULT '💬',
  cor text NOT NULL DEFAULT 'emerald',
  categoria_padrao public.comprovante_categoria NOT NULL DEFAULT 'nao_classificado',
  pedir_legenda_ja boolean NOT NULL DEFAULT false,
  aceita_pdf boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_whatsapp_id)
);

ALTER TABLE public.grupos_comprovantes ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY "Users manage own grupos_comprovantes"
ON public.grupos_comprovantes
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admin full access
CREATE POLICY "Admin manages all grupos_comprovantes"
ON public.grupos_comprovantes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Gerente can view
CREATE POLICY "Gerente can view grupos_comprovantes"
ON public.grupos_comprovantes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'gerente'::app_role));

-- Trigger updated_at
CREATE TRIGGER update_grupos_comprovantes_updated_at
BEFORE UPDATE ON public.grupos_comprovantes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookup by group_whatsapp_id (used by edge function)
CREATE INDEX idx_grupos_comprovantes_whatsapp_id 
ON public.grupos_comprovantes (group_whatsapp_id) 
WHERE ativo = true;

-- ============================================================
-- 2. Tabela: webhook_eventos_brutos (descoberta/diagnóstico)
-- ============================================================
CREATE TABLE public.webhook_eventos_brutos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_whatsapp_id text,
  sender text,
  chat_name text,
  message_type text,
  caption text,
  payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_eventos_brutos ENABLE ROW LEVEL SECURITY;

-- Admin and Gerente can read (for discovery UI)
CREATE POLICY "Admin and Gerente view webhook_eventos_brutos"
ON public.webhook_eventos_brutos
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'gerente'::app_role)
);

-- Index for time-based cleanup and queries
CREATE INDEX idx_webhook_eventos_brutos_created_at 
ON public.webhook_eventos_brutos (created_at DESC);

CREATE INDEX idx_webhook_eventos_brutos_group_id 
ON public.webhook_eventos_brutos (group_whatsapp_id, created_at DESC);

-- ============================================================
-- 3. Seed: migra grupos atualmente conhecidos
-- ============================================================
-- Para cada admin existente, cria os 2 grupos legados (Feira + Pagamentos).
-- ON CONFLICT DO NOTHING evita duplicatas se rodado novamente.
INSERT INTO public.grupos_comprovantes (
  user_id, group_whatsapp_id, nome, emoji, cor, categoria_padrao, pedir_legenda_ja, aceita_pdf, ativo
)
SELECT 
  ur.user_id,
  '120363043122353365-group',
  'Feira - Delookii',
  '🏟️',
  'blue',
  'nao_classificado'::public.comprovante_categoria,
  true,   -- usa lógica J/A da legenda
  false,  -- não aceita PDF
  true
FROM public.user_roles ur
WHERE ur.role = 'admin'::public.app_role
ON CONFLICT (user_id, group_whatsapp_id) DO NOTHING;

INSERT INTO public.grupos_comprovantes (
  user_id, group_whatsapp_id, nome, emoji, cor, categoria_padrao, pedir_legenda_ja, aceita_pdf, ativo
)
SELECT 
  ur.user_id,
  '120363402446093422-group',
  'Confirmação de Pagamento',
  '💰',
  'emerald',
  'nao_classificado'::public.comprovante_categoria,
  false,
  true,
  true
FROM public.user_roles ur
WHERE ur.role = 'admin'::public.app_role
ON CONFLICT (user_id, group_whatsapp_id) DO NOTHING;