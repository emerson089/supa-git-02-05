-- Sistema de Cobrança Automática via WhatsApp
-- Disparos: Quarta 14h, Quinta 9h, Quinta 15h (BRT = UTC-3)

-- 1. Extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Campo de exclusão por cliente (não disparar cobrança para este cliente)
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS excluir_cobranca_automatica BOOLEAN DEFAULT false;

-- 3. Campo de exclusão por pedido (não disparar cobrança para este pedido específico)
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS excluir_cobranca_automatica BOOLEAN DEFAULT false;

-- 4. Templates editáveis de mensagem de cobrança
CREATE TABLE IF NOT EXISTS public.templates_cobranca (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tentativa INTEGER NOT NULL CHECK (tentativa IN (1, 2, 3)),
    mensagem TEXT NOT NULL,
    ativo BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, tentativa)
);

ALTER TABLE public.templates_cobranca ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own templates_cobranca"
  ON public.templates_cobranca FOR ALL TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_templates_cobranca_updated_at
  BEFORE UPDATE ON public.templates_cobranca
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Histórico de cobranças enviadas (controle de duplicatas e auditoria)
CREATE TABLE IF NOT EXISTS public.cobrancas_enviadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
    cliente_nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    tentativa INTEGER NOT NULL CHECK (tentativa IN (1, 2, 3)),
    valor_total NUMERIC NOT NULL,
    mensagem TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado', 'falhou')),
    erro TEXT,
    enviado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(pedido_id, tentativa)
);

ALTER TABLE public.cobrancas_enviadas ENABLE ROW LEVEL SECURITY;

-- Histórico visível por qualquer usuário autenticado do mesmo projeto
CREATE POLICY "Authenticated users can view cobrancas_enviadas"
  ON public.cobrancas_enviadas FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role manages cobrancas_enviadas"
  ON public.cobrancas_enviadas FOR ALL TO service_role
  USING (true);

-- 6. Jobs pg_cron — chamam a Edge Function nos horários corretos
-- Os jobs usam net.http_post (pg_net) para disparar a Edge Function
-- A URL e service key são lidas das configurações do Supabase

DO $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  v_url := current_setting('app.settings.supabase_url', true);
  v_key := current_setting('app.settings.service_role_key', true);

  IF v_url IS NOT NULL AND v_key IS NOT NULL THEN
    -- Quarta-feira 14h BRT (17h UTC)
    PERFORM cron.schedule(
      'cobranca-quarta-14h',
      '0 17 * * 3',
      format(
        $cron$SELECT net.http_post(url := %L, headers := %L, body := %L)$cron$,
        v_url || '/functions/v1/cobranca-pendentes',
        json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key)::text,
        '{"tentativa":1}'
      )
    );

    -- Quinta-feira 9h BRT (12h UTC)
    PERFORM cron.schedule(
      'cobranca-quinta-9h',
      '0 12 * * 4',
      format(
        $cron$SELECT net.http_post(url := %L, headers := %L, body := %L)$cron$,
        v_url || '/functions/v1/cobranca-pendentes',
        json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key)::text,
        '{"tentativa":2}'
      )
    );

    -- Quinta-feira 15h BRT (18h UTC)
    PERFORM cron.schedule(
      'cobranca-quinta-15h',
      '0 18 * * 4',
      format(
        $cron$SELECT net.http_post(url := %L, headers := %L, body := %L)$cron$,
        v_url || '/functions/v1/cobranca-pendentes',
        json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key)::text,
        '{"tentativa":3}'
      )
    );
  END IF;
END $$;
