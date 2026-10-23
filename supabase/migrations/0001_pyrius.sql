-- Pyrius schema. Every user-owned table is protected by row-level security:
-- a signed-in user can only ever read or write their own rows.

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists conversations_user_idx on public.conversations (user_id, updated_at desc);

create table if not exists public.saved_offers (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('flight', 'hotel', 'car')),
  data jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.price_trackers (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  offer_id text not null,
  kind text not null check (kind in ('flight', 'hotel', 'car')),
  provider text not null,
  provider_offer_id text,
  currency text not null,
  last_known_price numeric not null,
  target_price numeric not null,
  last_checked_at timestamptz,
  status text not null default 'active',
  data jsonb not null,             -- full tracker incl. timestamped history
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Subscriptions are written only by the server (Stripe webhook, service role).
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'plus', 'pro')),
  status text not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text unique,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
alter table public.conversations enable row level security;
alter table public.saved_offers enable row level security;
alter table public.price_trackers enable row level security;
alter table public.subscriptions enable row level security;

create policy "own settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own conversations" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own saved offers" on public.saved_offers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own trackers" on public.price_trackers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Read-only for users; no insert/update/delete policy means only the service role can write.
create policy "read own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);
