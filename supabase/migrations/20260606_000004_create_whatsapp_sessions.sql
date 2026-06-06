create table if not exists public.whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  provider text not null default 'baileys',
  status text not null default 'disconnected',
  phone_number text,
  display_name text,
  qr_code text,
  server_session_id text,
  last_error text,
  last_connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, provider)
);

create index if not exists whatsapp_sessions_restaurant_id_idx on public.whatsapp_sessions(restaurant_id);
create index if not exists whatsapp_sessions_status_idx on public.whatsapp_sessions(status);

alter table public.whatsapp_sessions enable row level security;

create policy "whatsapp sessions select own restaurant"
on public.whatsapp_sessions
for select
using (restaurant_id in (select restaurant_id from public.restaurant_users where user_id = auth.uid()));

create policy "whatsapp sessions insert own restaurant"
on public.whatsapp_sessions
for insert
with check (restaurant_id in (select restaurant_id from public.restaurant_users where user_id = auth.uid()));

create policy "whatsapp sessions update own restaurant"
on public.whatsapp_sessions
for update
using (restaurant_id in (select restaurant_id from public.restaurant_users where user_id = auth.uid()))
with check (restaurant_id in (select restaurant_id from public.restaurant_users where user_id = auth.uid()));
