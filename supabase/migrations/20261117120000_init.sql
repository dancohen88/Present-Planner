-- Present Planner: shared plans, people, purchasers and gifts.
--
-- Access is decided here, in the database, by row-level security (RLS). The
-- app's connection key is public by design, so every rule that matters must
-- hold even against hand-written requests.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  -- set null, not cascade: deleting your account mustn't delete a plan the
  -- rest of the family still uses.
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.plan_members (
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 60),
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);

create table public.plan_invites (
  token uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  created_by uuid not null default auth.uid () references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days'
);

-- Someone gifts are for.
create table public.people (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  budget_pence integer check (budget_pence >= 0),
  -- Links this recipient to a member's account, which hides the card and its
  -- gifts from that member. The composite key means only a member of this
  -- plan can be linked, and the link clears itself if they leave.
  member_user_id uuid,
  created_at timestamptz not null default now(),
  unique (plan_id, id),
  foreign key (plan_id, member_user_id)
    references public.plan_members (plan_id, user_id)
    on delete set null (member_user_id)
);

-- Someone doing the buying. Needn't have an account (e.g. "Grandma").
create table public.purchasers (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  -- Colour slot 0-7, or 8 for the shared grey overflow colour.
  slot smallint not null check (slot between 0 and 8),
  user_id uuid,
  created_at timestamptz not null default now(),
  unique (plan_id, id),
  foreign key (plan_id, user_id)
    references public.plan_members (plan_id, user_id)
    on delete set null (user_id)
);

-- Two members adding buyers at the same moment can't take the same colour:
-- the second insert fails and the app retries with the next free slot.
-- Partial, because any number of buyers may share the overflow slot 8.
create unique index purchasers_plan_slot_key
  on public.purchasers (plan_id, slot)
  where slot < 8;

create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  person_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 200),
  price_pence integer check (price_pence >= 0),
  status text not null default 'idea'
    check (status in ('idea', 'bought', 'wrapped', 'given')),
  purchaser_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid () references auth.users (id) on delete set null,
  -- Composite keys keep a gift's person and purchaser inside the gift's own
  -- plan. They also mirror the app's reducer: removing a person removes their
  -- gifts, removing a purchaser unassigns theirs.
  foreign key (plan_id, person_id)
    references public.people (plan_id, id)
    on delete cascade,
  foreign key (plan_id, purchaser_id)
    references public.purchasers (plan_id, id)
    on delete set null (purchaser_id)
);

create index plan_members_user_id_idx on public.plan_members (user_id);
create index plan_invites_plan_id_idx on public.plan_invites (plan_id);
create index people_member_user_id_idx on public.people (member_user_id);
create index purchasers_user_id_idx on public.purchasers (plan_id, user_id);
create index gifts_plan_id_idx on public.gifts (plan_id);
create index gifts_person_id_idx on public.gifts (plan_id, person_id);
create index gifts_purchaser_id_idx on public.gifts (plan_id, purchaser_id);

-- Record who last changed a gift, and when, whatever the client sends.
create function public.touch_gift ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger gifts_touch
before update on public.gifts
for each row execute function public.touch_gift ();

-- ---------------------------------------------------------------------------
-- Helper functions used by the policies
-- ---------------------------------------------------------------------------
-- These are SECURITY DEFINER: they run with the owner's rights and so read
-- the tables without RLS. That matters twice over:
--   * a policy on plan_members that queried plan_members would recurse;
--   * is_my_gift_recipient must see the recipient's own person row, which RLS
--     hides from them. Under RLS that lookup would find nothing, and every
--     gift would look safe to show.
-- `set search_path = ''` stops a caller from swapping in look-alike tables.
-- `(select auth.uid())` is evaluated once per query, not once per row.

create function public.is_plan_member (p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.plan_members m
    where m.plan_id = p_plan_id and m.user_id = (select auth.uid ())
  );
$$;

create function public.is_plan_owner (p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.plan_members m
    where m.plan_id = p_plan_id
      and m.user_id = (select auth.uid ())
      and m.role = 'owner'
  );
$$;

-- True when the signed-in user is the recipient of gifts for this person.
create function public.is_my_gift_recipient (p_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.people p
    where p.id = p_person_id and p.member_user_id = (select auth.uid ())
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.plans enable row level security;
alter table public.plan_members enable row level security;
alter table public.plan_invites enable row level security;
alter table public.people enable row level security;
alter table public.purchasers enable row level security;
alter table public.gifts enable row level security;

-- Plans: created through create_plan(), so the creator becomes owner in the
-- same transaction. No direct insert policy.
create policy "members read their plans" on public.plans
for select to authenticated using (public.is_plan_member (id));

create policy "owners rename plans" on public.plans
for update to authenticated
using (public.is_plan_owner (id))
with check (public.is_plan_owner (id));

create policy "owners delete plans" on public.plans
for delete to authenticated using (public.is_plan_owner (id));

-- Members: joined through create_plan() or join_plan().
create policy "members see each other" on public.plan_members
for select to authenticated using (public.is_plan_member (plan_id));

create policy "members change their own display name" on public.plan_members
for update to authenticated
using (user_id = (select auth.uid ()))
with check (user_id = (select auth.uid ()));

create policy "members leave, owners remove" on public.plan_members
for delete to authenticated
using (user_id = (select auth.uid ()) or public.is_plan_owner (plan_id));

-- Invites
create policy "members see invites" on public.plan_invites
for select to authenticated using (public.is_plan_member (plan_id));

create policy "members create invites" on public.plan_invites
for insert to authenticated
with check (public.is_plan_member (plan_id) and created_by = (select auth.uid ()));

create policy "members revoke invites" on public.plan_invites
for delete to authenticated using (public.is_plan_member (plan_id));

-- People: the surprise rule. A member never sees, edits or creates the
-- person card linked to their own account.
create policy "members manage people, except themselves" on public.people
for all to authenticated
using (
  public.is_plan_member (plan_id)
  and member_user_id is distinct from (select auth.uid ())
)
with check (
  public.is_plan_member (plan_id)
  and member_user_id is distinct from (select auth.uid ())
);

create policy "members manage purchasers" on public.purchasers
for all to authenticated
using (public.is_plan_member (plan_id))
with check (public.is_plan_member (plan_id));

-- Gifts: the surprise rule again, so a gift for you is invisible to you even
-- if you know its id.
create policy "members manage gifts, except their own" on public.gifts
for all to authenticated
using (
  public.is_plan_member (plan_id)
  and not public.is_my_gift_recipient (person_id)
)
with check (
  public.is_plan_member (plan_id)
  and not public.is_my_gift_recipient (person_id)
);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
-- Signed-out visitors get nothing at all.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;

-- Column-level privileges: a member may change their display name, but not
-- their role or which plan they belong to.
revoke update on public.plan_members from authenticated;
grant update (display_name) on public.plan_members to authenticated;

-- Plans: only the name may change.
revoke insert, update on public.plans from authenticated;
grant update (name) on public.plans to authenticated;

-- Gifts: plan_id and the audit columns are fixed once written.
revoke update on public.gifts from authenticated;
grant update (person_id, title, price_pence, status, purchaser_id)
  on public.gifts to authenticated;

grant execute on function public.is_plan_member (uuid) to authenticated;
grant execute on function public.is_plan_owner (uuid) to authenticated;
grant execute on function public.is_my_gift_recipient (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Actions that need more than one row change, done atomically
-- ---------------------------------------------------------------------------

create function public.create_plan (p_name text, p_display_name text)
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
  return v_plan;
end;
$$;

-- What a join screen shows before you accept: works for non-members, but
-- only for someone holding a valid token.
create function public.invite_details (p_token uuid)
returns table (plan_id uuid, plan_name text, invited_by text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, coalesce(m.display_name, 'A member'), i.expires_at
  from public.plan_invites i
  join public.plans p on p.id = i.plan_id
  left join public.plan_members m
    on m.plan_id = i.plan_id and m.user_id = i.created_by
  where i.token = p_token and i.expires_at > now();
$$;

create function public.join_plan (p_token uuid, p_display_name text)
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
  return v_plan;
end;
$$;

grant execute on function public.create_plan (text, text) to authenticated;
grant execute on function public.invite_details (uuid) to authenticated;
grant execute on function public.join_plan (uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Live updates
-- ---------------------------------------------------------------------------
-- Realtime checks each change against the subscriber's RLS policies before
-- sending it, so hidden gifts never reach their recipient.
alter publication supabase_realtime
  add table public.people, public.purchasers, public.gifts, public.plan_members;
