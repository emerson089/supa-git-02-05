-- 1. Extensões necessárias para cron e HTTP
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Colunas de exclusão (idempotente)
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS excluir_cobranca_automatica BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.pedidos  ADD COLUMN IF NOT EXISTS excluir_cobranca_automatica BOOLEAN NOT NULL DEFAULT false;

-- 3. Templates editáveis de mensagem de cobrança
CREATE TABLE IF NOT EXISTS public.templates_cobranca (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tentativa INTEGER NOT NULL CHECK (tentativa IN (1, 2, 3)),
    mensagem TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, tentativa)
);

ALTER TABLE public.templates_cobranca ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own templates_cobranca" ON public.templates_cobranca;
CREATE POLICY "Users manage own templates_cobranca"
  ON public.templates_cobranca FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_templates_cobranca_updated_at ON public.templates_cobranca;
CREATE TRIGGER update_templates_cobranca_updated_at
  BEFORE UPDATE ON public.templates_cobranca
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Histórico de cobranças enviadas
CREATE TABLE IF NOT EXISTS public.cobrancas_enviadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
    cliente_nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    tentativa INTEGER NOT NULL CHECK (tentativa IN (1, 2, 3)),
    valor_total NUMERIC NOT NULL DEFAULT 0,
    mensagem TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado', 'falhou')),
    erro TEXT,
    enviado_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cobrancas_enviadas_pedido_tentativa
  ON public.cobrancas_enviadas (pedido_id, tentativa);

CREATE INDEX IF NOT EXISTS idx_cobrancas_enviadas_enviado_at
  ON public.cobrancas_enviadas (enviado_at DESC);

ALTER TABLE public.cobrancas_enviadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view cobrancas_enviadas" ON public.cobrancas_enviadas;
CREATE POLICY "Authenticated users can view cobrancas_enviadas"
  ON public.cobrancas_enviadas FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role manages cobrancas_enviadas" ON public.cobrancas_enviadas;
CREATE POLICY "Service role manages cobrancas_enviadas"
  ON public.cobrancas_enviadas FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Cron jobs (idempotentes — desagenda antes de reagendar)
DO $$
BEGIN
  PERFORM cron.unschedule('cobranca-quarta-14h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('cobranca-quinta-9h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('cobranca-quinta-15h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Quarta 14h BRT = 17h UTC
SELECT cron.schedule(
  'cobranca-quarta-14h',
  '0 17 * * 3',
  $cron$
  SELECT net.http_post(
    url := 'https://xoyyhtxakbrlzykthdca.supabase.co/functions/v1/cobranca-pendentes',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhveXlodHhha2JybHp5a3RoZGNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNDk5NTMsImV4cCI6MjA4MzcyNTk1M30.iLjRvEPfrVVbKRuEZsEpdVGzfFQnf0KfNqrQZgoLrlQ"}'::jsonb,
    body := '{"tentativa":1}'::jsonb
  );
  $cron$
);

-- Quinta 9h BRT = 12h UTC
SELECT cron.schedule(
  'cobranca-quinta-9h',
  '0 12 * * 4',
  $cron$
  SELECT net.http_post(
    url := 'https://xoyyhtxakbrlzykthdca.supabase.co/functions/v1/cobranca-pendentes',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhveXlodHhha2JybHp5a3RoZGNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNDk5NTMsImV4cCI6MjA4MzcyNTk1M30.iLjRvEPfrVVbKRuEZsEpdVGzfFQnf0KfNqrQZgoLrlQ"}'::jsonb,
    body := '{"tentativa":2}'::jsonb
  );
  $cron$
);

-- Quinta 15h BRT = 18h UTC
SELECT cron.schedule(
  'cobranca-quinta-15h',
  '0 18 * * 4',
  $cron$
  SELECT net.http_post(
    url := 'https://xoyyhtxakbrlzykthdca.supabase.co/functions/v1/cobranca-pendentes',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhveXlodHhha2JybHp5a3RoZGNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNDk5NTMsImV4cCI6MjA4MzcyNTk1M30.iLjRvEPfrVVbKRuEZsEpdVGzfFQnf0KfNqrQZgoLrlQ"}'::jsonb,
    body := '{"tentativa":3}'::jsonb
  );
  $cron$
);