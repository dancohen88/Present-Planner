-- Every member of a plan is also one of its buyers, linked to their account,
-- so "Who's buying" lists the family without anyone typing names in.
-- Buyers without accounts ("Grandma") can still be added by hand.

-- The lowest colour slot no buyer in the plan is using, or 8 (the shared
-- grey) when all eight colours are taken. Mirrors nextPurchaserSlot in
-- src/domain/planner.ts.
create function public.next_purchaser_slot (p_plan_id uuid)
returns smallint
language sql
stable
set search_path = ''
as $$
  select coalesce(min(s.slot), 8)::smallint
  from generate_series(0, 7) as s(slot)
  where not exists (
    select 1 from public.purchasers p
    where p.plan_id = p_plan_id and p.slot = s.slot
  );
$$;

revoke all on function public.next_purchaser_slot (uuid) from anon, public;

create or replace function public.create_plan (p_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid ();
  v_plan uuid;
begin
  if v_user is null then
    raise exception 'Sign in to create a plan' using errcode = '28000';
  end if;
  insert into public.plans (name, created_by)
  values (trim(p_name), v_user)
  returning id into v_plan;
  insert into public.plan_members (plan_id, user_id, display_name, role)
  values (v_plan, v_user, trim(p_display_name), 'owner');
  insert into public.purchasers (plan_id, name, slot, user_id)
  values (v_plan, trim(p_display_name), 0, v_user);
  return v_plan;
end;
$$;

create or replace function public.join_plan (p_token uuid, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid ();
  v_plan uuid;
  v_joined int;
begin
  if v_user is null then
    raise exception 'Sign in to join a plan' using errcode = '28000';
  end if;
  select i.plan_id into v_plan
  from public.plan_invites i
  where i.token = p_token and i.expires_at > now();
  if v_plan is null then
    raise exception 'This invite link has expired or been revoked'
      using errcode = 'P0002';
  end if;
  insert into public.plan_members (plan_id, user_id, display_name, role)
  values (v_plan, v_user, trim(p_display_name), 'member')
  on conflict (plan_id, user_id) do nothing;
  get diagnostics v_joined = row_count;
  -- Only on a first join, so opening the link twice doesn't add a second
  -- buyer. Serialise on the plan row so two people joining at once can't
  -- pick the same colour.
  if v_joined > 0 then
    perform 1 from public.plans where id = v_plan for update;
    insert into public.purchasers (plan_id, name, slot, user_id)
    values (v_plan, trim(p_display_name), public.next_purchaser_slot (v_plan), v_user);
  end if;
  return v_plan;
end;
$$;
