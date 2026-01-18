-- Criar profile e role admin para o usuário existente (delockjeans@gmail.com)
-- Isso garante que o primeiro usuário seja admin

-- Primeiro, criar profile se não existir
INSERT INTO public.profiles (id, user_id, email, nome, status)
SELECT id, id, email, COALESCE(raw_user_meta_data->>'nome', raw_user_meta_data->>'name', 'Admin'), 'ativo'
FROM auth.users
WHERE email = 'delockjeans@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  nome = COALESCE(EXCLUDED.nome, profiles.nome),
  status = 'ativo';

-- Depois, definir como admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'delockjeans@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;