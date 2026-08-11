create or replace function public.facturar_proforma_atomica(
  p_proforma_id uuid,
  p_fecha_factura date default current_date
)
returns table (factura_id uuid, numero_factura text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.proformas%rowtype;
  v_factura_id uuid;
  v_numero text;
  v_anio integer;
  v_siguiente integer;
begin
  select * into v_p from public.proformas where id=p_proforma_id for update;
  if not found then raise exception 'La proforma no existe.'; end if;
  if lower(trim(v_p.estado)) <> 'enviada' then
    if lower(trim(v_p.estado))='cancelada' then
      raise exception 'No puedes facturar esta proforma porque ha sido cancelada.';
    elsif lower(trim(v_p.estado))='facturada' then
      raise exception 'Esta proforma ya esta facturada.';
    else
      raise exception 'Solo se pueden facturar proformas en estado Enviada.';
    end if;
  end if;
  v_anio:=extract(year from p_fecha_factura)::integer;
  perform pg_advisory_xact_lock(hashtext('NOC_FACTURA_'||v_anio::text));
  select coalesce(max(case when numero ~ ('^F'||v_anio::text||'-[0-9]{4,}$') then split_part(numero,'-',2)::integer else null end),0)+1
    into v_siguiente from public.facturas where extract(year from fecha)::integer=v_anio;
  v_numero:='F'||v_anio::text||'-'||lpad(v_siguiente::text,4,'0');
  insert into public.facturas(numero,fecha,cliente_id,proforma_id,forma_pago,base_imponible,iva,recargo,total,observaciones)
  values(v_numero,p_fecha_factura,v_p.cliente_id,v_p.id,v_p.forma_pago,v_p.base_imponible,v_p.iva,v_p.recargo,v_p.total,v_p.observaciones)
  returning id into v_factura_id;
  insert into public.lineas_factura(factura_id,articulo_id,descripcion,precio_unitario,cantidad,descuento,tallaje,orden,es_envio)
  select v_factura_id,articulo_id,descripcion,precio_unitario,cantidad,descuento,tallaje,orden,es_envio from public.lineas_proforma where proforma_id=v_p.id order by orden;
  update public.proformas set estado='Facturada' where id=v_p.id;
  return query select v_factura_id,v_numero;
end;
$$;
revoke all on function public.facturar_proforma_atomica(uuid,date) from public;
grant execute on function public.facturar_proforma_atomica(uuid,date) to authenticated;
