-- Enable RLS on event_settings
alter table public.event_settings enable row level security;

-- Allow read access to everyone (anon and authenticated)
create policy "Event settings are readable by everyone"
  on public.event_settings for select
  using (true);

-- Note: No insert/update/delete policies are created. 
-- This means only the service_role key (used by our server-side admin client) 
-- can modify this table, which is the desired behavior for security.
