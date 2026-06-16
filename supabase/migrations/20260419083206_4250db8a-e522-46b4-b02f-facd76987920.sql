-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Interviews
create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  resume_text text,
  questions jsonb not null default '[]'::jsonb,
  answers jsonb not null default '[]'::jsonb,
  feedback jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index interviews_user_created_idx on public.interviews(user_id, created_at desc);

alter table public.interviews enable row level security;

create policy "Users view own interviews" on public.interviews
  for select using (auth.uid() = user_id);
create policy "Users insert own interviews" on public.interviews
  for insert with check (auth.uid() = user_id);
create policy "Users update own interviews" on public.interviews
  for update using (auth.uid() = user_id);
create policy "Users delete own interviews" on public.interviews
  for delete using (auth.uid() = user_id);