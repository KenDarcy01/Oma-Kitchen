-- Oma's Kitchen cookbook. Lives alongside Family Quiz in the same Supabase project;
-- every object is prefixed oma_ / oma- so nothing collides with the quiz.
create table public.oma_recipes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  category text not null default 'Baking',
  season text,
  yield_amount numeric,
  yield_unit text,
  total_minutes integer,
  oven_c integer,
  gas_mark text,
  difficulty text,
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  tip text,
  original_text text,
  card_image_path text,
  photo_path text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index oma_recipes_category_idx on public.oma_recipes (category);
create index oma_recipes_created_idx on public.oma_recipes (created_at desc);

alter table public.oma_recipes enable row level security;
-- Anyone with the link can read published recipes. Writes go through the app server with the service role key.
create policy "oma_recipes public read" on public.oma_recipes
  for select to anon, authenticated using (published);

create or replace function public.oma_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger oma_recipes_touch before update on public.oma_recipes
  for each row execute function public.oma_touch_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('oma-photos', 'oma-photos', true, 15728640, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
