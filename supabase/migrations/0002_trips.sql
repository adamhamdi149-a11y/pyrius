-- My Trips: trips the user plans, and reservations confirmed by a booking provider.
-- Users manage their own trips. Reservations are read-only for users: only the Pyrius server
-- (service role), acting on a provider's confirmation (Duffel, Booking.com), can write them, so the
-- app can never show a booking that doesn't exist.

create table if not exists public.trips (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  start_date date,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.reservations (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id text not null,
  kind text not null check (kind in ('flight', 'hotel', 'car')),
  provider text not null check (provider in ('duffel', 'booking.com')),
  provider_ref text not null,
  status text not null check (status in ('confirmed', 'pending', 'changed', 'cancelled')),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (provider, provider_ref)
);

create index if not exists reservations_trip on public.reservations (user_id, trip_id);

alter table public.trips enable row level security;
alter table public.reservations enable row level security;

create policy "own trips" on public.trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Read-only for users; no insert/update/delete policy means only the service role can write.
create policy "read own reservations" on public.reservations
  for select using (auth.uid() = user_id);
