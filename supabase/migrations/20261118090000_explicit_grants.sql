-- Give signed-in users exactly the table access the app uses, and nothing
-- else ("least privilege"), instead of relying on platform defaults. Local
-- stacks grant everything by default, including TRUNCATE, which empties a
-- table and ignores row-level security. Hosted projects can be set to grant
-- nothing, which would break the app. Being explicit makes both the same.
--
-- Row-level security still decides which rows each user can touch; these
-- grants decide which kinds of statement they may run at all.

-- Revoking table privileges also revokes column-level ones, so the column
-- grants from the first migration are restated below.
revoke all on all tables in schema public from authenticated;

grant usage on schema public to authenticated;

-- Plans: read and delete (owners only, by RLS); rename only.
grant select, delete on public.plans to authenticated;
grant update (name) on public.plans to authenticated;

-- Members: joined only through create_plan() and join_plan(); a member may
-- change their display name, not their role.
grant select, delete on public.plan_members to authenticated;
grant update (display_name) on public.plan_members to authenticated;

-- Invites: create, list and revoke; never edited.
grant select, insert, delete on public.plan_invites to authenticated;

grant select, insert, update, delete on public.people to authenticated;
grant select, insert, update, delete on public.purchasers to authenticated;

-- Gifts: plan_id and the audit columns are fixed once written.
grant select, insert, delete on public.gifts to authenticated;
grant update (person_id, title, price_pence, status, purchaser_id)
  on public.gifts to authenticated;
