
-- Função segura para confirmar a troca de senha
-- Esta função permite que o próprio usuário limpe sua flag 'must_change_password'
-- de forma legítima após realizar a troca via Supabase Auth.

CREATE OR REPLACE FUNCTION public.confirm_password_change()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET must_change_password = false,
      updated_at = now()
  WHERE id = auth.uid();
END;
$$;

-- Atualizar o gatilho de proteção para permitir que a função confirm_password_change funcione
-- ou que o próprio dono do perfil (ou admin) limpe a flag.

CREATE OR REPLACE FUNCTION public.fn_protect_must_change_password()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Se a flag 'must_change_password' estiver mudando de TRUE para FALSE
  IF OLD.must_change_password = true AND NEW.must_change_password = false THEN
    -- PERMITIR se:
    -- 1. O usuário logado for um ADMIN
    -- 2. O usuário logado for o DONO do perfil (auth.uid() = NEW.id)
    -- Isso permite que a página de AlterarSenha e a função RPC funcionem.
    
    IF NOT (public.has_role(auth.uid(), 'admin') OR auth.uid() = NEW.id) THEN
      -- Se não for nenhum dos dois, reverte a mudança por segurança
      NEW.must_change_password := OLD.must_change_password;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
