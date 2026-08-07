-- V3.3 PASO 1 — PREPARAR (NO CIERRA TODAVÍA EL ACCESO ANÓNIMO)
create table if not exists public.configuracion (
  id integer primary key default 1 check (id=1),
  empresa text,cif text,direccion text,codigo_postal text,localidad text,provincia text,
  telefono text,email text,web text,logo_url text,pie_documentos text,
  iva_general numeric(6,2) not null default 21,
  recargo_general numeric(6,2) not null default 5.2,
  updated_at timestamptz not null default now()
);
alter table public.configuracion enable row level security;
drop policy if exists "noc_config_authenticated" on public.configuracion;
create policy "noc_config_authenticated" on public.configuracion for all to authenticated using (true) with check (true);
grant select,insert,update,delete on public.configuracion to authenticated;
insert into public.configuracion(id) values(1) on conflict(id) do nothing;
