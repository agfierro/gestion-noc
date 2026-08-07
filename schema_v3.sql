-- GESTIÓN NOC V3
-- Ejecutar UNA VEZ en Supabase > SQL Editor.
-- No borra tablas ni datos existentes de V2.2.

create or replace function public.sincronizar_numeraciones()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  max_p bigint := 0;
  max_f bigint := 0;
begin
  select coalesce(max(case when numero ~ '^P-[0-9]+$' then substring(numero from 3)::bigint else 0 end),0)
    into max_p from public.proformas;
  select coalesce(max(case when numero ~ '^F-[0-9]+$' then substring(numero from 3)::bigint else 0 end),0)
    into max_f from public.facturas;

  perform setval('public.proforma_seq', greatest(max_p + 1,1), false);
  perform setval('public.factura_seq', greatest(max_f + 1,1), false);
end;
$$;

revoke all on function public.sincronizar_numeraciones() from public;
grant execute on function public.sincronizar_numeraciones() to anon, authenticated;
