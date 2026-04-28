ALTER TABLE public.perfil_configuracoes
ADD COLUMN IF NOT EXISTS saudacoes_personalizadas text[] NOT NULL DEFAULT '{}';