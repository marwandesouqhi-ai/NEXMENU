-- Migration 006: Subscription date validation and audit log indexes
-- Extends subscriptions with date consistency checks and explicit column constraints

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'check_subscription_dates'
  ) then
    alter table public.subscriptions
      add constraint check_subscription_dates
      check (expires_at >= starts_at);
  end if;
end $$;

-- Comments explaining the subscription lifecycle and derived status
comment on column public.subscriptions.starts_at is 'Subscription start timestamp (ISO 8601).';
comment on column public.subscriptions.expires_at is 'Subscription expiration timestamp (ISO 8601). Must be >= starts_at.';
comment on column public.subscriptions.notes is 'Internal administrative notes for this subscription.';
comment on column public.subscriptions.status is 'Explicit subscription status: ACTIVE, SUSPENDED, or EXPIRED. Derived status: active, expiring_soon (within 14 days of expires_at), or expired.';
