-- Fix overly permissive SELECT policies on transferencias and transferencia_itens tables
-- These tables currently allow any authenticated user to read all records

-- Drop the overly permissive SELECT policy on transferencias
DROP POLICY IF EXISTS "Authenticated users can read all transferencias" ON public.transferencias;

-- Create proper owner-scoped SELECT policy for transferencias
CREATE POLICY "Users can read own transferencias" 
ON public.transferencias 
FOR SELECT 
USING (auth.uid() = user_id);

-- Drop the overly permissive SELECT policy on transferencia_itens
DROP POLICY IF EXISTS "Authenticated users can read all transferencia_itens" ON public.transferencia_itens;

-- Create proper owner-scoped SELECT policy for transferencia_itens
CREATE POLICY "Users can read own transferencia_itens" 
ON public.transferencia_itens 
FOR SELECT 
USING (auth.uid() = user_id);