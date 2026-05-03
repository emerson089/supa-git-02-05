-- Adicionar 'estornada' à constraint de status de transferências
ALTER TABLE public.transferencias
DROP CONSTRAINT IF EXISTS transferencias_status_check;

ALTER TABLE public.transferencias
ADD CONSTRAINT transferencias_status_check
CHECK (status = ANY (ARRAY[
  'em_andamento'::text,
  'concluida'::text,
  'cancelada'::text,
  'estornada'::text
]));