-- Add explicit DENY policies for anonymous users on sensitive tables
-- This adds defense-in-depth by explicitly denying anonymous access

-- Deny anonymous access to profiles
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles FOR ALL
TO anon
USING (false);

-- Deny anonymous access to user_roles
CREATE POLICY "Deny anonymous access to user_roles"
ON public.user_roles FOR ALL
TO anon
USING (false);

-- Deny anonymous access to clientes
CREATE POLICY "Deny anonymous access to clientes"
ON public.clientes FOR ALL
TO anon
USING (false);