grant usage on schema public to anon;
grant select, insert on table public.chat_logs to anon;
grant usage, select on all sequences in schema public to anon;

alter table public.chat_logs enable row level security;

drop policy if exists "Allow anonymous reads" on public.chat_logs;
drop policy if exists "Allow anonymous inserts" on public.chat_logs;

create policy "Allow anonymous reads"
  on public.chat_logs
  for select
  to anon
  using (true);

create policy "Allow anonymous inserts"
  on public.chat_logs
  for insert
  to anon
  with check (true);
