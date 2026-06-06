alter table public.message_logs add column if not exists delivered_at timestamptz;
alter table public.message_logs add column if not exists opened_at timestamptz;
alter table public.message_logs add column if not exists clicked_at timestamptz;
alter table public.message_logs add column if not exists opened boolean not null default false;
alter table public.message_logs add column if not exists clicked boolean not null default false;
alter table public.message_logs add column if not exists clicked_url text;
alter table public.message_logs add column if not exists last_event_type text;
alter table public.message_logs add column if not exists last_event_at timestamptz;

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  message_log_id uuid references public.message_logs(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  provider text not null default 'resend',
  provider_message_id text not null,
  event_type text not null,
  event_status text not null,
  recipient_email text,
  clicked_url text,
  raw_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists email_events_restaurant_id_idx on public.email_events(restaurant_id);
create index if not exists email_events_campaign_id_idx on public.email_events(campaign_id);
create index if not exists email_events_message_log_id_idx on public.email_events(message_log_id);
create index if not exists email_events_provider_message_id_idx on public.email_events(provider_message_id);
create index if not exists email_events_event_type_idx on public.email_events(event_type);

alter table public.email_events enable row level security;
