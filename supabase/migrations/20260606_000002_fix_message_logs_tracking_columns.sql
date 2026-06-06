alter table public.message_logs add column if not exists provider text;
alter table public.message_logs add column if not exists external_id text;
alter table public.message_logs add column if not exists error_message text;
alter table public.message_logs add column if not exists sent_at timestamptz;
alter table public.message_logs add column if not exists delivered_at timestamptz;
alter table public.message_logs add column if not exists opened_at timestamptz;
alter table public.message_logs add column if not exists clicked_at timestamptz;
alter table public.message_logs add column if not exists opened boolean not null default false;
alter table public.message_logs add column if not exists clicked boolean not null default false;
alter table public.message_logs add column if not exists clicked_url text;
alter table public.message_logs add column if not exists last_event_type text;
alter table public.message_logs add column if not exists last_event_at timestamptz;

create index if not exists message_logs_external_id_idx on public.message_logs(external_id);
create index if not exists message_logs_campaign_id_idx on public.message_logs(campaign_id);
create index if not exists message_logs_restaurant_id_idx on public.message_logs(restaurant_id);
