-- Upgrade Master: Envios em Massa
-- Tabelas para suporte a agendamento, histórico, segmentação e blacklist

-- 1. Blacklist / Lista de Exclusão
CREATE TABLE IF NOT EXISTS public.blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    telefone TEXT NOT NULL,
    motivo TEXT,
    origem TEXT DEFAULT 'manual', -- 'manual' ou 'auto'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, telefone)
);

-- 2. Histórico de Campanhas
CREATE TABLE IF NOT EXISTS public.campanhas_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    catalogo_id UUID REFERENCES public.catalogos(id) ON DELETE SET NULL,
    nome_campanha TEXT NOT NULL,
    total_contatos INTEGER DEFAULT 0,
    sucessos INTEGER DEFAULT 0,
    falhas INTEGER DEFAULT 0,
    duplicados INTEGER DEFAULT 0,
    filtros_aplicados JSONB DEFAULT '{}'::jsonb,
    velocidade TEXT,
    duracao INTERVAL,
    data_disparo TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Envios Agendados
CREATE TABLE IF NOT EXISTS public.envios_agendados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    catalogo_id UUID REFERENCES public.catalogos(id) ON DELETE CASCADE,
    config_agendamento JSONB NOT NULL, -- {data, hora_inicio, hora_fim, dias_semana, horario_comercial}
    status TEXT DEFAULT 'Pendente', -- 'Pendente', 'Em andamento', 'Concluido', 'Cancelado'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Configurações de Perfil (Limites e Anti-Ban)
CREATE TABLE IF NOT EXISTS public.perfil_configuracoes (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    limite_diario_mensagens INTEGER DEFAULT 500,
    pausa_inteligente BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Atualização da tabela Clientes (Segmentação e LGPD)
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'Novo';
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS total_comprado NUMERIC DEFAULT 0;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS data_ultima_compra TIMESTAMPTZ;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS opt_out BOOLEAN DEFAULT false;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS falhas_consecutivas INTEGER DEFAULT 0;

-- 6. Atualização da tabela Catálogos (Múltiplos formatos)
ALTER TABLE public.catalogos ADD COLUMN IF NOT EXISTS arquivos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.catalogos ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

-- 7. Segurança (RLS)
ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanhas_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.envios_agendados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfil_configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own blacklist" ON public.blacklist FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users manage own historico" ON public.campanhas_historico FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users manage own agendados" ON public.envios_agendados FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users manage own perfil_config" ON public.perfil_configuracoes FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 8. Trigger para updated_at no perfil
CREATE TRIGGER update_perfil_config_updated_at BEFORE UPDATE ON public.perfil_configuracoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
