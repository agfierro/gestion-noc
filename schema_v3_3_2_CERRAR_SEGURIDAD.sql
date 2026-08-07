-- V3.3 PASO 2 — CERRAR SEGURIDAD
-- EJECUTAR SOLO TRAS COMPROBAR QUE EL LOGIN FUNCIONA.

drop policy if exists "noc_test_all_tipos_envio" on public.tipos_envio;
drop policy if exists "noc_test_all_clientes" on public.clientes;
drop policy if exists "noc_test_all_articulos" on public.articulos;
drop policy if exists "noc_test_all_proformas" on public.proformas;
drop policy if exists "noc_test_all_lineas_proforma" on public.lineas_proforma;
drop policy if exists "noc_test_all_facturas" on public.facturas;
drop policy if exists "noc_test_all_lineas_factura" on public.lineas_factura;
drop policy if exists "noc_test_all_gastos" on public.gastos;

drop policy if exists "test_all_tipos_envio" on public.tipos_envio;
drop policy if exists "test_all_clientes" on public.clientes;
drop policy if exists "test_all_articulos" on public.articulos;
drop policy if exists "test_all_proformas" on public.proformas;
drop policy if exists "test_all_lineas_proforma" on public.lineas_proforma;
drop policy if exists "test_all_facturas" on public.facturas;
drop policy if exists "test_all_lineas_factura" on public.lineas_factura;
drop policy if exists "test_all_gastos" on public.gastos;

alter table public.tipos_envio enable row level security;
alter table public.clientes enable row level security;
alter table public.articulos enable row level security;
alter table public.proformas enable row level security;
alter table public.lineas_proforma enable row level security;
alter table public.facturas enable row level security;
alter table public.lineas_factura enable row level security;
alter table public.gastos enable row level security;
alter table public.configuracion enable row level security;

drop policy if exists "noc_auth_tipos_envio" on public.tipos_envio;
drop policy if exists "noc_auth_clientes" on public.clientes;
drop policy if exists "noc_auth_articulos" on public.articulos;
drop policy if exists "noc_auth_proformas" on public.proformas;
drop policy if exists "noc_auth_lineas_proforma" on public.lineas_proforma;
drop policy if exists "noc_auth_facturas" on public.facturas;
drop policy if exists "noc_auth_lineas_factura" on public.lineas_factura;
drop policy if exists "noc_auth_gastos" on public.gastos;

create policy "noc_auth_tipos_envio" on public.tipos_envio for all to authenticated using (true) with check (true);
create policy "noc_auth_clientes" on public.clientes for all to authenticated using (true) with check (true);
create policy "noc_auth_articulos" on public.articulos for all to authenticated using (true) with check (true);
create policy "noc_auth_proformas" on public.proformas for all to authenticated using (true) with check (true);
create policy "noc_auth_lineas_proforma" on public.lineas_proforma for all to authenticated using (true) with check (true);
create policy "noc_auth_facturas" on public.facturas for all to authenticated using (true) with check (true);
create policy "noc_auth_lineas_factura" on public.lineas_factura for all to authenticated using (true) with check (true);
create policy "noc_auth_gastos" on public.gastos for all to authenticated using (true) with check (true);

revoke select,insert,update,delete on public.tipos_envio,public.clientes,public.articulos,public.proformas,public.lineas_proforma,public.facturas,public.lineas_factura,public.gastos,public.configuracion from anon;
grant select,insert,update,delete on public.tipos_envio,public.clientes,public.articulos,public.proformas,public.lineas_proforma,public.facturas,public.lineas_factura,public.gastos,public.configuracion to authenticated;

revoke execute on function public.siguiente_numero_proforma() from anon;
revoke execute on function public.siguiente_numero_factura() from anon;
grant execute on function public.siguiente_numero_proforma() to authenticated;
grant execute on function public.siguiente_numero_factura() to authenticated;

do $$
begin
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='sincronizar_numeraciones') then
   revoke execute on function public.sincronizar_numeraciones() from anon;
   grant execute on function public.sincronizar_numeraciones() to authenticated;
 end if;
end $$;
