-- Who may add and change recipes. Family Quiz users share this auth, so writes are limited to this list.
-- Add someone:  insert into public.oma_editors (email) values ('name@example.com');
create table public.oma_editors (
  email text primary key check (email = lower(email)),
  added_at timestamptz not null default now()
);
alter table public.oma_editors enable row level security;
-- No policies on oma_editors: only the dashboard / service role manage it.

create or replace function public.oma_is_editor() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.oma_editors e
    where e.email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );
$$;
revoke execute on function public.oma_is_editor() from public, anon;
grant execute on function public.oma_is_editor() to authenticated;

create policy "oma_recipes editors insert" on public.oma_recipes
  for insert to authenticated with check ((select public.oma_is_editor()));
create policy "oma_recipes editors update" on public.oma_recipes
  for update to authenticated using ((select public.oma_is_editor())) with check ((select public.oma_is_editor()));
create policy "oma_recipes editors delete" on public.oma_recipes
  for delete to authenticated using ((select public.oma_is_editor()));
-- Editors also see unpublished drafts.
create policy "oma_recipes editors read all" on public.oma_recipes
  for select to authenticated using ((select public.oma_is_editor()));

create policy "oma-photos editors upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'oma-photos' and (select public.oma_is_editor()));
create policy "oma-photos editors update" on storage.objects
  for update to authenticated using (bucket_id = 'oma-photos' and (select public.oma_is_editor()));
create policy "oma-photos editors delete" on storage.objects
  for delete to authenticated using (bucket_id = 'oma-photos' and (select public.oma_is_editor()));
