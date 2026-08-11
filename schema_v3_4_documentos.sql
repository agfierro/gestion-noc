-- GESTIÓN NOC V3.4 — DOCUMENTOS Y NUMERACIÓN ANUAL
-- Ejecutar UNA SOLA VEZ en Supabase > SQL Editor.
-- No borra proformas, facturas, clientes ni artículos.

alter table public.configuracion add column if not exists cuenta_bancaria text;
alter table public.configuracion add column if not exists direccion_pie text;
alter table public.configuracion add column if not exists cp_pie text;
alter table public.configuracion add column if not exists localidad_pie text;

-- Contadores independientes por tipo de documento y año.
create table if not exists public.numeradores_documentos (
  tipo text not null check (tipo in ('PF','F')),
  anio integer not null,
  ultimo integer not null default 0,
  primary key (tipo, anio)
);

alter table public.numeradores_documentos enable row level security;

drop policy if exists "noc_auth_numeradores_documentos" on public.numeradores_documentos;
create policy "noc_auth_numeradores_documentos"
on public.numeradores_documentos
for select
to authenticated
using (true);

grant select on public.numeradores_documentos to authenticated;

-- Inicializa los contadores leyendo documentos ya existentes de cualquier formato reconocido.
insert into public.numeradores_documentos(tipo,anio,ultimo)
select 'PF', extract(year from fecha)::integer,
       coalesce(max(
         case
           when numero ~ '^PF[0-9]{4}-[0-9]+$' then split_part(numero,'-',2)::integer
           when numero ~ '^P-[0-9]+$' then split_part(numero,'-',2)::integer
           else 0
         end
       ),0)
from public.proformas
group by extract(year from fecha)::integer
on conflict(tipo,anio) do update set ultimo=greatest(public.numeradores_documentos.ultimo,excluded.ultimo);

insert into public.numeradores_documentos(tipo,anio,ultimo)
select 'F', extract(year from fecha)::integer,
       coalesce(max(
         case
           when numero ~ '^F[0-9]{4}-[0-9]+$' then split_part(numero,'-',2)::integer
           when numero ~ '^F-[0-9]+$' then split_part(numero,'-',2)::integer
           else 0
         end
       ),0)
from public.facturas
group by extract(year from fecha)::integer
on conflict(tipo,anio) do update set ultimo=greatest(public.numeradores_documentos.ultimo,excluded.ultimo);

create or replace function public.siguiente_numero_proforma()
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  y integer := extract(year from current_date)::integer;
  n integer;
begin
  insert into public.numeradores_documentos(tipo,anio,ultimo)
  values('PF',y,1)
  on conflict(tipo,anio)
  do update set ultimo=public.numeradores_documentos.ultimo+1
  returning ultimo into n;

  return 'PF' || y::text || '-' || lpad(n::text,4,'0');
end;
$$;

create or replace function public.siguiente_numero_factura()
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  y integer := extract(year from current_date)::integer;
  n integer;
begin
  insert into public.numeradores_documentos(tipo,anio,ultimo)
  values('F',y,1)
  on conflict(tipo,anio)
  do update set ultimo=public.numeradores_documentos.ultimo+1
  returning ultimo into n;

  return 'F' || y::text || '-' || lpad(n::text,4,'0');
end;
$$;

revoke execute on function public.siguiente_numero_proforma() from anon;
revoke execute on function public.siguiente_numero_factura() from anon;
grant execute on function public.siguiente_numero_proforma() to authenticated;
grant execute on function public.siguiente_numero_factura() to authenticated;

-- Rehacer sincronización para los nuevos formatos.
create or replace function public.sincronizar_numeraciones()
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  r record;
begin
  for r in
    select extract(year from fecha)::integer as y,
           coalesce(max(case when numero ~ '^PF[0-9]{4}-[0-9]+$' then split_part(numero,'-',2)::integer else 0 end),0) as n
    from public.proformas
    group by extract(year from fecha)::integer
  loop
    insert into public.numeradores_documentos(tipo,anio,ultimo) values('PF',r.y,r.n)
    on conflict(tipo,anio) do update set ultimo=greatest(public.numeradores_documentos.ultimo,excluded.ultimo);
  end loop;

  for r in
    select extract(year from fecha)::integer as y,
           coalesce(max(case when numero ~ '^F[0-9]{4}-[0-9]+$' then split_part(numero,'-',2)::integer else 0 end),0) as n
    from public.facturas
    group by extract(year from fecha)::integer
  loop
    insert into public.numeradores_documentos(tipo,anio,ultimo) values('F',r.y,r.n)
    on conflict(tipo,anio) do update set ultimo=greatest(public.numeradores_documentos.ultimo,excluded.ultimo);
  end loop;
end;
$$;

revoke execute on function public.sincronizar_numeraciones() from anon;
grant execute on function public.sincronizar_numeraciones() to authenticated;
