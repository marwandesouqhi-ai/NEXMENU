-- ==============================================================================
-- 009_profile_protection_security_definer_fix.sql
-- Resolves:
-- 1. Security regression in 008: protect_profile_sensitive_columns() evaluated
--    `current_user` inside a SECURITY DEFINER function. Because current_user
--    is the function owner (postgres), the privileged bypass evaluated to true
--    for all callers.
-- 2. Fixed check: Privileged bypass applies ONLY when:
--    `auth.uid() is null AND session_user not in ('authenticator','anon','authenticated')`.
--    Never relies on current_user inside SECURITY DEFINER.
-- 3. Retains all 007 security invariants:
--    - Changing profile id is blocked.
--    - Changing profile email is blocked.
--    - Changing platform_role requires public.is_super_admin().
-- 4. Defense-in-depth column privileges:
--    Revoke table-level UPDATE on profiles from anon and authenticated,
--    and grant UPDATE strictly on (name) to authenticated.
-- ==============================================================================

create or replace function public.protect_profile_sensitive_columns()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_is_privileged boolean;
begin
  -- Privileged bypass ONLY when running without a JWT (auth.uid() is null)
  -- AND session_user is a privileged DB role (NOT the connection pooler or client roles).
  -- IMPORTANT: Never check current_user inside a SECURITY DEFINER function,
  -- as current_user resolves to the function owner (postgres) for all callers.
  v_is_privileged := (
    auth.uid() is null and
    session_user not in ('authenticator', 'anon', 'authenticated')
  );

  -- If genuinely executing from a privileged DB session (SQL Editor / CLI operator), permit update
  if v_is_privileged then
    NEW.updated_at := now();
    return NEW;
  end if;

  -- Prevent client connections from altering identity/email
  if (NEW.id <> OLD.id) then
    raise exception 'Changing profile ID is not permitted.';
  end if;

  if (NEW.email <> OLD.email) then
    raise exception 'Changing profile email directly is not permitted.';
  end if;

  -- Only super administrators can modify platform_role
  if (NEW.platform_role is distinct from OLD.platform_role) and not public.is_super_admin() then
    raise exception 'Only super administrators can alter platform_role.';
  end if;

  NEW.updated_at := now();
  return NEW;
end;
$$;

-- Defense in depth: restrict column-level UPDATE permissions
revoke update on public.profiles from anon, authenticated;
grant update (name) on public.profiles to authenticated;
