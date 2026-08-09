alter table public.lineas_proforma
drop constraint if exists lineas_proforma_cantidad_check;

alter table public.lineas_proforma
add constraint lineas_proforma_cantidad_check
check (cantidad <> 0);

alter table public.lineas_factura
drop constraint if exists lineas_factura_cantidad_check;

alter table public.lineas_factura
add constraint lineas_factura_cantidad_check
check (cantidad <> 0);
