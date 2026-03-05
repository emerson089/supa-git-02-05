
-- Fix 1: Prevent users from directly setting must_change_password to false
-- Use a trigger to block direct updates to must_change_password
CREATE OR REPLACE FUNCTION public.fn_protect_must_change_password()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- If must_change_password is being changed from true to false
  IF OLD.must_change_password = true AND NEW.must_change_password = false THEN
    -- Only allow if the caller is an admin OR if called from a SECURITY DEFINER context
    -- Check if caller is admin
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      -- For non-admins, revert the change (keep must_change_password as true)
      -- They should use the AlterarSenha page which updates password first
      NEW.must_change_password := OLD.must_change_password;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_must_change_password
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_protect_must_change_password();
