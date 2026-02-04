-- Enable realtime for producao table
ALTER PUBLICATION supabase_realtime ADD TABLE public.producao;

-- Enable realtime for producao_log table
ALTER PUBLICATION supabase_realtime ADD TABLE public.producao_log;