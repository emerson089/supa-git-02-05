
## Diagnóstico

Reproduzi o problema da Maria (`emerson089@gmail.com.br`) cruzando 3 fontes:

**Auth logs (Supabase):**
```
07:48:17  PUT /user  422  same_password   ← tentou senha igual à temp
07:48:22  PUT /user  422  same_password   ← tentou de novo
07:48:29  PUT /user  200  OK              ← finalmente trocou
07:53:05  POST /token 400 refresh_token_not_found  ← sessão expirou
```

**Banco:** `must_change_password = true` ainda hoje, mesmo após o update bem-sucedido às 07:48:29.

**Causa raiz — três bugs encadeados em `src/pages/AlterarSenha.tsx`:**

1. **Senha igual à temporária retorna erro cru.** O Supabase retorna `same_password` ("New password should be different from the old password") em inglês. O usuário não entende e tenta de novo. Não há validação client-side que avise antes.

2. **`UPDATE profiles` sem checagem de erro nem garantia de execução.** Após `supabase.auth.updateUser({password})`, em alguns casos a sessão é rotacionada/invalidada e o `UPDATE` em `profiles` falha por RLS (sem `auth.uid()` válido) — mas o código faz `await supabase.from('profiles').update(...)` sem checar `.error`, então o toast de sucesso aparece e o flag continua `true` para sempre. Resultado: o vendedor faz login → cai em `/alterar-senha` → "muda" a senha → é redirecionado → próximo login cai de novo em `/alterar-senha`. Loop eterno.

3. **`refreshProfile()` corre antes do update do banco propagar.** Mesmo quando o update funciona, o refresh é disparado em paralelo e pode ler o valor antigo, mantendo `mustChangePassword=true` em memória → ProtectedRoute redireciona de volta.

Há ainda um problema de UX adjacente: o badge "Senha pendente" na tela de Gestão de Usuários nunca sai porque depende do mesmo flag.

## Solução

### 1. `src/pages/AlterarSenha.tsx` — reescrita do `handleSubmit`

- Validar e tratar `same_password` ANTES de chamar Supabase: avisar "A nova senha precisa ser diferente da senha temporária".
- Após `auth.updateUser({password})` retornar OK, chamar **uma RPC server-side** `mark_password_changed()` (security definer) em vez de UPDATE direto na tabela. Isso elimina a dependência de RLS/sessão.
- Checar o `error` da RPC explicitamente. Se falhar, mostrar toast e NÃO redirecionar.
- Aguardar `await refreshProfile()` ANTES de `navigate()`.
- Mapear todas as mensagens do Supabase Auth para PT-BR (`same_password`, `weak_password`, `session_not_found`).

### 2. Nova RPC `public.mark_password_changed()` (migration)

```sql
create or replace function public.mark_password_changed()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  update public.profiles
    set must_change_password = false,
        updated_at = now()
    where user_id = auth.uid();
end;
$$;

revoke all on function public.mark_password_changed() from public;
grant execute on function public.mark_password_changed() to authenticated;
```

Roda como definer → não esbarra em corridas/RLS.

### 3. `src/pages/Auth.tsx` — redirect direto p/ landing correta

Hoje após login redireciona para `/`. O `Index` então decide. Manter, mas garantir que o `ProtectedRoute` em `/alterar-senha` deixe o usuário entrar mesmo sem role definido (vendedor recém-criado).

Verificado: `ProtectedRoute` já lida com isso (sem `allowedRoles` em `/alterar-senha`). OK.

### 4. Correção retroativa para a Maria

Migration adicional roda uma vez:
```sql
update public.profiles
   set must_change_password = false
 where user_id = '19a575cc-e97b-4b32-9bf5-99da2d6c2471'
   and last_sign_in_at is not null;
```
Ela já trocou a senha com sucesso (log 200 às 07:48:29), o flag só ficou preso pelo bug. Isso destrava o login dela imediatamente.

### 5. Melhoria de UX no formulário

- Mostrar dica visível: "Use uma senha **diferente** da que você recebeu por mensagem."
- Validar mínimo 8 chars + maiúscula/minúscula/número (já existe no schema, manter).

## Arquivos alterados

- `supabase/migrations/<timestamp>_mark_password_changed_rpc.sql` (novo)
- `src/pages/AlterarSenha.tsx` (reescrita do submit + dica visual + tradução de erros)

## Fora de escopo

- Não vou mexer em `invite-user` (geração de senha temp está OK).
- Não vou mexer em `RoleContext` nem `ProtectedRoute` — a lógica deles está correta, o bug era só no fluxo de "alterar senha".
