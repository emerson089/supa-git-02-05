-- 1. campanhas_historico
CREATE TABLE public.campanhas_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome_campanha TEXT NOT NULL,
  catalogo_id UUID NULL,
  total_contatos INTEGER NOT NULL DEFAULT 0,
  sucessos INTEGER NOT NULL DEFAULT 0,
  falhas INTEGER NOT NULL DEFAULT 0,
  filtros_aplicados JSONB NOT NULL DEFAULT '{}'::jsonb,
  velocidade TEXT NOT NULL DEFAULT 'normal',
  data_disparo TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campanhas_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own campanhas_historico"
  ON public.campanhas_historico
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_campanhas_historico_user_data ON public.campanhas_historico(user_id, data_disparo DESC);

-- 2. blacklist
CREATE TABLE public.blacklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  telefone TEXT NOT NULL,
  motivo TEXT NOT NULL DEFAULT '',
  origem TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, telefone)
);

ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own blacklist"
  ON public.blacklist
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. perfil_configuracoes
CREATE TABLE public.perfil_configuracoes (
  user_id UUID NOT NULL PRIMARY KEY,
  limite_diario_mensagens INTEGER NOT NULL DEFAULT 100,
  pausa_inteligente BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.perfil_configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own perfil_configuracoes"
  ON public.perfil_configuracoes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_perfil_configuracoes_updated_at
  BEFORE UPDATE ON public.perfil_configuracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();