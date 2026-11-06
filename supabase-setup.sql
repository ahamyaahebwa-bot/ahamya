-- Cedar Park gallery: run this ONCE in Supabase (SQL Editor > New query > paste > Run).
-- It is safe to run again if something went wrong the first time.

-- 1) The list of photos -------------------------------------------------------
create table if not exists public.photos (
    id          uuid primary key default gen_random_uuid(),
    file_id     text not null unique,
    space       text not null check (space in ('venue', 'hall')),
    width       integer not null check (width > 0),
    height      integer not null check (height > 0),
    created_at  timestamptz not null default now()
);

alter table public.photos enable row level security;

-- Everyone can LOOK at the photos (that is the public gallery page).
drop policy if exists "Anyone can view photos" on public.photos;
create policy "Anyone can view photos"
    on public.photos for select to anon, authenticated using (true);

-- Only a signed-in staff account can add, change or delete.
drop policy if exists "Staff can add photos" on public.photos;
create policy "Staff can add photos"
    on public.photos for insert to authenticated with check (true);

drop policy if exists "Staff can edit photos" on public.photos;
create policy "Staff can edit photos"
    on public.photos for update to authenticated using (true) with check (true);

drop policy if exists "Staff can delete photos" on public.photos;
create policy "Staff can delete photos"
    on public.photos for delete to authenticated using (true);

-- 2) The place the picture files are stored ------------------------------------
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone can view gallery files" on storage.objects;
create policy "Anyone can view gallery files"
    on storage.objects for select to anon, authenticated using (bucket_id = 'gallery');

drop policy if exists "Staff can upload gallery files" on storage.objects;
create policy "Staff can upload gallery files"
    on storage.objects for insert to authenticated with check (bucket_id = 'gallery');

drop policy if exists "Staff can delete gallery files" on storage.objects;
create policy "Staff can delete gallery files"
    on storage.objects for delete to authenticated using (bucket_id = 'gallery');
