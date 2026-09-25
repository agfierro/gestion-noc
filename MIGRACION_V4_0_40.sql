-- Gestión NOC V4.0.40
-- Permite indicar cuántos portes/envíos contiene una proforma.
-- Las proformas existentes quedan con 1 envío, por compatibilidad.

alter table public.proformas
  add column if not exists envio_cantidad integer not null default 1;

update public.proformas
set envio_cantidad = 1
where envio_cantidad is null or envio_cantidad < 1;

alter table public.proformas
  drop constraint if exists proformas_envio_cantidad_check;

alter table public.proformas
  add constraint proformas_envio_cantidad_check check (envio_cantidad >= 1);
