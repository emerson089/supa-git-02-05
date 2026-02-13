
-- Create immutable audit log for role changes
CREATE TABLE public.role_change_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  old_role text,
  new_role text NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.role_change_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs, nobody can update/delete
CREATE POLICY "Admins can view audit logs"
ON public.role_change_audit_log
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- No update or delete policies = immutable log

-- Trigger to automatically log role changes
CREATE OR REPLACE FUNCTION public.fn_log_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO public.role_change_audit_log (user_id, old_role, new_role, changed_by)
    VALUES (NEW.user_id, OLD.role::text, NEW.role::text, auth.uid());
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.role_change_audit_log (user_id, old_role, new_role, changed_by)
    VALUES (NEW.user_id, NULL, NEW.role::text, auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.role_change_audit_log (user_id, old_role, new_role, changed_by)
    VALUES (OLD.user_id, OLD.role::text, 'DELETED', auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_role_changes
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.fn_log_role_change();
