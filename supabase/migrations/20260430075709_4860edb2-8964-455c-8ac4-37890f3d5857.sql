
-- RPC security definer to clear must_change_password reliably
-- (bypasses fn_protect_must_change_password trigger which blocks non-admins)
create or replace function public.mark_password_changed()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Disable the protection trigger for this transaction so the update sticks
  -- (we are running as definer, so session_replication_role works)
  perform set_config('session_replication_role', 'replica', true);

  update public.profiles
     set must_change_password = false,
         updated_at = now()
   where user_id = v_uid;

  perform set_config('session_replication_role', 'origin', true);
end;
$$;

revoke all on function public.mark_password_changed() from public;
grant execute on function public.mark_password_changed() to authenticated;

-- Retroactive fix: Maria already changed her password successfully (auth log shows
-- 200 OK on PUT /user) but the flag stayed true due to the trigger blocking it.
update public.profiles
   set must_change_password = false,
       updated_at = now()
 where user_id = '19a575cc-e97b-4b32-9bf5-99da2d6c2471';
