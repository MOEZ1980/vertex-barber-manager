-- VERTEX HAMMAMI: elimina automaticamente le prenotazioni terminate.
-- Eseguire una sola volta nel SQL Editor Supabase del progetto esistente.
-- La pulizia elimina definitivamente le prenotazioni passate, ma conserva gli orari bloccati.

create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create or replace function public.vertex_cleanup_expired_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer := 0;
begin
  delete from public.bookings b
  where b.ends_at is not null
    and b.ends_at < now()
    and coalesce(b.status, '') <> 'blocked'
    and coalesce(b.customer_name, '') <> 'BLOCCATO';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.vertex_cleanup_expired_bookings() from public, anon, authenticated;
grant execute on function public.vertex_cleanup_expired_bookings() to postgres;

select cron.schedule(
  'vertex-auto-delete-expired-bookings',
  '*/15 * * * *',
  'select public.vertex_cleanup_expired_bookings();'
);
