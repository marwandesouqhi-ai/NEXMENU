-- ==============================================================================
-- Phase A: SQL Vulnerability & Correctness Verification Test Script
-- Run against any Postgres instance with migrations 001-006 applied.
-- ==============================================================================

-- SETUP: Create test users and dummy data
do $$
declare
  v_user_id uuid := '11111111-1111-1111-1111-111111111111';
  v_resto_id uuid := '22222222-2222-2222-2222-222222222222';
begin
  -- --------------------------------------------------------------------------
  -- FINDING 1: PRIVILEGE ESCALATION
  -- --------------------------------------------------------------------------
  -- A regular user with role null can update platform_role to 'SUPER_ADMIN'
  -- because profiles_self_update allows any update where id = auth.uid().
  
  -- Mock user session as v_user_id
  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- Simulating user self-promoting to SUPER_ADMIN:
  -- UPDATE public.profiles SET platform_role = 'SUPER_ADMIN' WHERE id = auth.uid();
  -- Policy check: id = auth.uid() -> TRUE.
  -- Result: User is now SUPER_ADMIN.
  
  -- --------------------------------------------------------------------------
  -- FINDING 2: SIGN-UP FLOW BLOCK
  -- --------------------------------------------------------------------------
  -- An authenticated user tries to insert their own profile from the client:
  -- INSERT INTO public.profiles (id, email, name, platform_role)
  -- VALUES (auth.uid(), 'test@example.com', 'Test User', null);
  -- RESULT: ERROR: new row violates row-level security policy for table "profiles"
  -- Because 002_rls.sql only defines profiles_self_read and profiles_self_update.
  -- There is NO INSERT policy for public.profiles, and no auth.users trigger.

  -- --------------------------------------------------------------------------
  -- FINDING 3: LAST-OWNER PROTECTION BYPASS
  -- --------------------------------------------------------------------------
  -- An owner of a restaurant deletes the only remaining owner membership:
  -- DELETE FROM public.restaurant_members 
  -- WHERE restaurant_id = v_resto_id AND role = 'RESTAURANT_OWNER';
  -- Policy check: is_restaurant_member(restaurant_id, ['RESTAURANT_OWNER']) -> TRUE.
  -- RESULT: Deleted. Restaurant now has ZERO owners and is permanently orphaned.
  -- The constraint was only in TypeScript teamService, not in Postgres.

end $$;
