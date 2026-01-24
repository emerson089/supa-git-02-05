-- Adicionar coluna paid_at nullable (retrocompatível)
ALTER TABLE public.pedidos 
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ NULL;

-- Criar índice para queries de faturamento por data de pagamento
CREATE INDEX IF NOT EXISTS idx_pedidos_paid_at ON public.pedidos(paid_at) 
WHERE paid_at IS NOT NULL;

-- Criar índice composto para queries do dashboard (status_pagamento + paid_at)
CREATE INDEX IF NOT EXISTS idx_pedidos_status_paid_at ON public.pedidos(status_pagamento, paid_at) 
WHERE status_pagamento = 'PAGO';

-- Função para definir paid_at automaticamente
CREATE OR REPLACE FUNCTION public.fn_set_paid_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Se mudou para PAGO e paid_at ainda é NULL, definir agora
  IF NEW.status_pagamento = 'PAGO' 
     AND (OLD IS NULL OR OLD.status_pagamento IS DISTINCT FROM 'PAGO')
     AND NEW.paid_at IS NULL THEN
    NEW.paid_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Remover trigger se existir (para idempotência)
DROP TRIGGER IF EXISTS trigger_set_paid_at ON public.pedidos;

-- Criar trigger para INSERT e UPDATE
CREATE TRIGGER trigger_set_paid_at
BEFORE INSERT OR UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_set_paid_at();

-- Migrar dados legados: usar updated_at como estimativa para pedidos já pagos
UPDATE public.pedidos
SET paid_at = updated_at
WHERE status_pagamento = 'PAGO'
  AND paid_at IS NULL;