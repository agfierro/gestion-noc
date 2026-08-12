window.NOC=window.NOC||{};
NOC.Informes=(()=>{
  let currentRows=[];
  let currentCriteria=null;
  let currentReport=localStorage.getItem("noc_current_report")||"comercial";
  let articuloCatalogo=[];

  function isoToday(){return new Date().toISOString().slice(0,10)}
  function firstOfMonth(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`}
  function dateEs(iso){
    if(!iso)return"";
    const [y,m,d]=String(iso).split("-");
    return `${d}/${m}/${y}`;
  }
  function csvCell(v){
    const s=String(v??"");
    return /[;"\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
  }
  function downloadBlob(name,data,type){
    const blob=new Blob([data],{type});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1200);
  }
  function totals(rows){
    return rows.reduce((a,r)=>{
      a.base+=Number(r.base_imponible||0);
      a.iva+=Number(r.iva||0);
      a.re+=Number(r.recargo||0);
      a.total+=Number(r.total||0);
      return a;
    },{base:0,iva:0,re:0,total:0});
  }

  async function render(){
    const clientes=await NOC.API.list("clientes",{select:"comercial"});
    const comerciales=[...new Set(
      clientes.map(c=>String(c.comercial||"").trim()).filter(Boolean)
    )].sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"}));

    document.getElementById("viewContainer").innerHTML=`
      <div class="grid noc-view noc-view-informes">
        <div class="card col-12">
          <div class="report-tabs">
            <button class="btn ${currentReport==="dashboard"?"btn-primary":""}" onclick="NOC.Informes.cambiarInforme('dashboard')">Dashboard</button>
            <button class="btn ${currentReport==="comercial"?"btn-primary":""}" onclick="NOC.Informes.cambiarInforme('comercial')">Por comercial</button>
            <button class="btn ${currentReport==="ventas"?"btn-primary":""}" onclick="NOC.Informes.cambiarInforme('ventas')">Ventas</button>
            <button class="btn ${currentReport==="articulos"?"btn-primary":""}" onclick="NOC.Informes.cambiarInforme('articulos')">Artículos</button>
            <button class="btn ${currentReport==="fiscal3000"?"btn-primary":""}" onclick="NOC.Informes.cambiarInforme('fiscal3000')">Puntos de venta +3.000 €</button>
          </div>
          <div id="reportFilters"></div>
        </div>
        <div id="reportResult" class="card col-12" style="display:none"></div>
      </div>`;

    if(currentReport==="dashboard"){
      document.getElementById("reportResult").style.display="none";
      await NOC.Dashboard.renderReport("reportFilters");
    }else if(currentReport==="ventas")drawVentasFilters();
    else if(currentReport==="articulos")await drawArticulosFilters();
    else if(currentReport==="fiscal3000")await drawFiscal3000Filters();
    else drawCommercialFilters(comerciales);
  }

  async function cambiarInforme(tipo){
    currentReport=tipo;
    localStorage.setItem("noc_current_report",tipo);
    currentRows=[];
    currentCriteria=null;
    await render();
  }

  function drawCommercialFilters(comerciales){
    document.getElementById("reportFilters").innerHTML=`
      <h2>Informe por comercial</h2>
      <p class="muted">Selecciona comercial, tipo de documento y periodo. Las fechas de inicio y fin están incluidas.</p>
      <form id="reportCommercialForm" class="form-grid" onsubmit="event.preventDefault();NOC.Informes.generarComercial()">
        <div class="field f3">
          <label>Comercial</label>
          <select id="repComercial" required>
            <option value="">Seleccionar…</option>
            ${comerciales.map(c=>`<option value="${NOC.App.esc(c)}">${NOC.App.esc(c)}</option>`).join("")}
          </select>
        </div>
        <div class="field f3">
          <label>Tipo</label>
          <select id="repTipo" required>
            <option value="facturado">Facturado</option>
            <option value="proformado">Proformado</option>
          </select>
        </div>
        <div class="field f3">
          <label>Fecha inicio</label>
          <input id="repDesde" type="date" required value="${firstOfMonth()}">
        </div>
        <div class="field f3">
          <label>Fecha fin</label>
          <input id="repHasta" type="date" required value="${isoToday()}">
        </div>
        <div class="f12 toolbar" style="margin:4px 0 0"><div></div><button class="btn btn-primary" type="submit">Generar informe</button></div>
      </form>`;
  }

  function drawVentasFilters(){
    document.getElementById("reportFilters").innerHTML=`
      <h2>Informe de ventas</h2>
      <p class="muted">Facturas comprendidas entre ambas fechas, incluyendo el día inicial y el día final.</p>
      <form id="reportSalesForm" class="form-grid" onsubmit="event.preventDefault();NOC.Informes.generarVentas()">
        <div class="field f3">
          <label>Tipo de venta</label>
          <select id="ventasTipo" required>
            <option value="mayorista">Mayorista</option>
            <option value="particulares">Particulares</option>
            <option value="todas">Todas</option>
          </select>
        </div>
        <div class="field f3"><label>Fecha inicio</label><input id="ventasDesde" type="date" required value="${firstOfMonth()}"></div>
        <div class="field f3"><label>Fecha fin</label><input id="ventasHasta" type="date" required value="${isoToday()}"></div>
        <div class="f3 toolbar" style="align-items:end"><div></div><button class="btn btn-primary" type="submit">Generar informe</button></div>
      </form>`;
  }

  async function drawFiscal3000Filters(){
    let anos=[];
    try{
      const {data,error}=await NOC.API.db().from("facturas").select("fecha").order("fecha",{ascending:false});
      if(error)throw error;
      anos=[...new Set((data||[]).map(r=>String(r.fecha||"").slice(0,4)).filter(Boolean))];
    }catch(e){}
    if(!anos.length)anos=[String(new Date().getFullYear())];
    document.getElementById("reportFilters").innerHTML=`
      <h2>Puntos de venta con más de 3.000 € de base</h2>
      <p class="muted">Agrupa la facturación anual por punto de venta. Los particulares quedan excluidos.</p>
      <form class="form-grid" onsubmit="event.preventDefault();NOC.Informes.generarFiscal3000()">
        <div class="field f3"><label>Año</label><select id="fiscal3000Year">${anos.map(y=>`<option value="${y}">${y}</option>`).join("")}</select></div>
        <div class="field f3"><label>Base mínima</label><input id="fiscal3000Min" type="number" step="0.01" value="3000"></div>
        <div class="f6 toolbar" style="align-items:end"><div></div><button class="btn btn-primary" type="submit">Generar informe</button></div>
      </form>`;
  }

  async function generarFiscal3000(){
    const year=document.getElementById("fiscal3000Year").value;
    const minimo=Number(document.getElementById("fiscal3000Min").value||3000);
    const desde=`${year}-01-01`,hasta=`${year}-12-31`;
    NOC.App.showProgress("Generando informe…",`Puntos de venta · ${year}`);
    try{
      const {data,error}=await NOC.API.db().from("facturas")
        .select("id,cliente_id,base_imponible,iva,recargo,total,clientes(nombre_tienda,nombre,apellidos,dni_cif,localidad_facturacion,provincia_facturacion)")
        .gte("fecha",desde).lte("fecha",hasta);
      if(error)throw error;
      const map=new Map();
      (data||[]).filter(r=>String(r.clientes?.nombre_tienda||"").trim().toLocaleLowerCase("es")!=="particular").forEach(r=>{
        const key=r.cliente_id||r.clientes?.nombre_tienda;
        if(!map.has(key))map.set(key,{
          tienda:r.clientes?.nombre_tienda||"",
          cliente:[r.clientes?.nombre,r.clientes?.apellidos].filter(Boolean).join(" "),
          cif:r.clientes?.dni_cif||"",
          localidad:r.clientes?.localidad_facturacion||"",
          provincia:r.clientes?.provincia_facturacion||"",
          base:0,iva:0,re:0,total:0,facturas:0
        });
        const x=map.get(key);
        x.base+=Number(r.base_imponible||0);x.iva+=Number(r.iva||0);x.re+=Number(r.recargo||0);x.total+=Number(r.total||0);x.facturas++;
      });
      currentRows=[...map.values()].filter(r=>r.base>minimo).sort((a,b)=>b.base-a.base);
      currentCriteria={report:"fiscal3000",year,minimo};
      NOC.App.hideProgress();
      drawFiscal3000Result();
    }catch(e){
      NOC.App.hideProgress();
      NOC.App.alertMessage("Error al generar informe","No se ha podido generar el informe. "+(e.message||e),"error");
    }
  }

  function drawFiscal3000Result(){
    const box=document.getElementById("reportResult"),c=currentCriteria;
    const totals=currentRows.reduce((a,r)=>{a.base+=r.base;a.iva+=r.iva;a.re+=r.re;a.total+=r.total;return a},{base:0,iva:0,re:0,total:0});
    box.style.display="";
    box.innerHTML=`
      <div class="report-head">
        <div><div class="report-brand">NOC THE BRAND</div><h2 style="margin:2px 0 5px">Puntos de venta con más de ${NOC.App.money(c.minimo)} de base</h2><div class="muted">Año ${c.year}</div></div>
        <div class="toolbar-right"><button class="btn" onclick="NOC.Informes.exportCsv()">Exportar CSV</button><button class="btn btn-primary" onclick="NOC.Informes.imprimir()">Imprimir / Guardar PDF</button></div>
      </div>
      <div class="table-wrap"><table class="report-table">
        <thead><tr><th>Tienda</th><th>Cliente</th><th>CIF/NIF</th><th>Localidad</th><th>Provincia</th><th class="num">Nº facturas</th><th class="num">Base</th><th class="num">IVA</th><th class="num">RE</th><th class="num">Total</th></tr></thead>
        <tbody>${currentRows.map(r=>`<tr><td><strong>${NOC.App.esc(r.tienda)}</strong></td><td>${NOC.App.esc(r.cliente)}</td><td>${NOC.App.esc(r.cif)}</td><td>${NOC.App.esc(r.localidad)}</td><td>${NOC.App.esc(r.provincia)}</td><td class="num">${r.facturas}</td><td class="num">${NOC.App.money(r.base)}</td><td class="num">${NOC.App.money(r.iva)}</td><td class="num">${NOC.App.money(r.re)}</td><td class="num"><strong>${NOC.App.money(r.total)}</strong></td></tr>`).join("")||`<tr><td colspan="10" class="empty">No hay puntos de venta que superen la base indicada.</td></tr>`}</tbody>
        ${currentRows.length?`<tfoot><tr class="report-total-row"><td colspan="6"><strong>TOTALES</strong></td><td class="num"><strong>${NOC.App.money(totals.base)}</strong></td><td class="num"><strong>${NOC.App.money(totals.iva)}</strong></td><td class="num"><strong>${NOC.App.money(totals.re)}</strong></td><td class="num"><strong>${NOC.App.money(totals.total)}</strong></td></tr></tfoot>`:""}
      </table></div>
      <div class="report-count muted">${currentRows.length} punto(s) de venta</div>`;
    box.scrollIntoView({behavior:"smooth",block:"start"});
  }

  async function drawArticulosFilters(){
    try{
      articuloCatalogo=await NOC.API.list("articulos",{order:"nombre_producto",ascending:true});
    }catch(e){
      articuloCatalogo=[];
    }
    const fabricas=[...new Set(articuloCatalogo.map(a=>String(a.fabrica||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
    const tipos=[...new Set(articuloCatalogo.map(a=>String(a.tipo_prenda||a.tipo_articulo||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));

    document.getElementById("reportFilters").innerHTML=`
      <h2>Informe de artículos</h2>
      <p class="muted">Todos los filtros son opcionales. Si no seleccionas ninguno, se mostrarán todos los artículos vendidos.</p>
      <form id="reportArticlesForm" class="form-grid" onsubmit="event.preventDefault();NOC.Informes.generarArticulos()">
        <div class="field f3"><label>Fecha inicio</label><input id="artDesde" type="date"></div>
        <div class="field f3"><label>Fecha fin</label><input id="artHasta" type="date"></div>
        <div class="field f3"><label>Fábrica</label><select id="artFabrica"><option value="">Todas</option>${fabricas.map(v=>`<option value="${NOC.App.esc(v)}">${NOC.App.esc(v)}</option>`).join("")}</select></div>
        <div class="field f3"><label>Tipo</label><select id="artTipo"><option value="">Todos</option>${tipos.map(v=>`<option value="${NOC.App.esc(v)}">${NOC.App.esc(v)}</option>`).join("")}</select></div>
        <div class="field f6"><label>Artículo</label><select id="artArticulo"><option value="">Todos</option>${articuloCatalogo.map(a=>`<option value="${a.id}">${NOC.App.esc(a.nombre_producto)}${a.sku?` · ${NOC.App.esc(a.sku)}`:""}</option>`).join("")}</select></div>
        <div class="f6 toolbar" style="align-items:end"><div></div><button class="btn btn-primary" type="submit">Generar informe</button></div>
      </form>`;
  }

  async function generarArticulos(){
    const desde=document.getElementById("artDesde").value;
    const hasta=document.getElementById("artHasta").value;
    const fabrica=document.getElementById("artFabrica").value.trim();
    const tipo=document.getElementById("artTipo").value.trim();
    const articuloId=document.getElementById("artArticulo").value;

    if(desde&&hasta&&desde>hasta)return NOC.App.alertMessage("Periodo incorrecto","La fecha de inicio no puede ser posterior a la fecha fin.","error");

    NOC.App.showProgress("Generando informe de artículos…","Analizando ventas facturadas");
    try{
      let q=NOC.API.db().from("lineas_factura")
        .select("id,articulo_id,descripcion,cantidad,precio_unitario,descuento,es_envio,facturas!inner(fecha,numero),articulos(id,nombre_producto,sku,fabrica,tipo_articulo,tipo_prenda)")
        .eq("es_envio",false);

      if(desde)q=q.gte("facturas.fecha",desde);
      if(hasta)q=q.lte("facturas.fecha",hasta);
      if(articuloId)q=q.eq("articulo_id",articuloId);

      const {data,error}=await q;
      if(error)throw error;
      let rows=(data||[]).filter(r=>{
        const numero=String(r.facturas?.numero||"").trim().toUpperCase();
        // Las facturas WEB históricas no tienen artículo real desglosado.
        // Se excluyen del informe de artículos para no mostrar "Particular"
        // como si fuera un producto.
        return !numero.startsWith("WEB");
      });

      if(fabrica)rows=rows.filter(r=>String(r.articulos?.fabrica||"")===fabrica);
      if(tipo)rows=rows.filter(r=>String(r.articulos?.tipo_prenda||r.articulos?.tipo_articulo||"")===tipo);

      const map=new Map();
      rows.forEach(r=>{
        const a=r.articulos||{};
        const key=r.articulo_id||r.descripcion;
        if(!map.has(key))map.set(key,{
          articulo:a.nombre_producto||r.descripcion||"",
          sku:a.sku||"",
          tipo:a.tipo_prenda||a.tipo_articulo||"",
          fabrica:a.fabrica||"",
          unidades:0,
          facturado:0
        });
        const x=map.get(key);
        const cantidad=Number(r.cantidad||0);
        const precio=Number(r.precio_unitario||0);
        const descuento=Number(r.descuento||0);
        x.unidades+=cantidad;
        x.facturado+=precio*cantidad*(1-descuento/100);
      });

      currentRows=[...map.values()].sort((a,b)=>b.unidades-a.unidades||b.facturado-a.facturado);
      currentCriteria={report:"articulos",desde,hasta,fabrica,tipo,articuloId};
      NOC.App.hideProgress();
      drawArticulosResult();
    }catch(e){
      NOC.App.hideProgress();
      NOC.App.alertMessage("Error al generar informe","No se ha podido obtener el informe de artículos. "+(e.message||e),"error");
    }
  }

  function drawArticulosResult(){
    const box=document.getElementById("reportResult");
    const totalUnidades=currentRows.reduce((a,r)=>a+Number(r.unidades||0),0);
    const totalFacturado=currentRows.reduce((a,r)=>a+Number(r.facturado||0),0);
    const c=currentCriteria;
    const filtros=[
      c.desde?`Desde ${dateEs(c.desde)}`:"",
      c.hasta?`Hasta ${dateEs(c.hasta)}`:"",
      c.fabrica?`Fábrica: ${c.fabrica}`:"",
      c.tipo?`Tipo: ${c.tipo}`:""
    ].filter(Boolean).join(" · ")||"Sin filtros";

    box.style.display="";
    box.innerHTML=`
      <div class="report-head">
        <div><div class="report-brand">NOC THE BRAND</div><h2 style="margin:2px 0 5px">Informe de artículos</h2><div class="muted">${NOC.App.esc(filtros)}</div></div>
        <div class="toolbar-right"><button class="btn" onclick="NOC.Informes.exportCsv()">Exportar CSV</button><button class="btn btn-primary" onclick="NOC.Informes.imprimir()">Imprimir / Guardar PDF</button></div>
      </div>
      <div class="article-report-metrics">
        <div class="dash-metric-card"><div class="dash-metric-label">Unidades netas</div><div class="dash-metric-value">${totalUnidades.toLocaleString("es-ES")}</div></div>
        <div class="dash-metric-card"><div class="dash-metric-label">Facturación líneas</div><div class="dash-metric-value">${NOC.App.money(totalFacturado)}</div></div>
        <div class="dash-metric-card"><div class="dash-metric-label">Artículos distintos</div><div class="dash-metric-value">${currentRows.length}</div></div>
      </div>
      <div class="table-wrap">
        <table class="report-table">
          <thead><tr><th>Artículo</th><th>SKU</th><th>Tipo</th><th>Fábrica</th><th class="num">Unidades vendidas</th><th class="num">Importe facturado</th></tr></thead>
          <tbody>${currentRows.map((r,i)=>`<tr>
            <td><strong>${NOC.App.esc(r.articulo)}</strong>${i<3&&r.unidades>0?` <span class="rank-badge">#${i+1}</span>`:""}</td>
            <td>${NOC.App.esc(r.sku)}</td><td>${NOC.App.esc(r.tipo)}</td><td>${NOC.App.esc(r.fabrica)}</td>
            <td class="num"><strong>${Number(r.unidades).toLocaleString("es-ES")}</strong></td>
            <td class="num">${NOC.App.money(r.facturado)}</td>
          </tr>`).join("")||`<tr><td colspan="6" class="empty">No hay ventas que coincidan con los filtros seleccionados.</td></tr>`}</tbody>
          ${currentRows.length?`<tfoot><tr class="report-total-row"><td colspan="4"><strong>TOTALES</strong></td><td class="num"><strong>${totalUnidades.toLocaleString("es-ES")}</strong></td><td class="num"><strong>${NOC.App.money(totalFacturado)}</strong></td></tr></tfoot>`:""}
        </table>
      </div>`;
    box.scrollIntoView({behavior:"smooth",block:"start"});
  }

  async function generarComercial(){
    const comercial=document.getElementById("repComercial").value.trim();
    const tipo=document.getElementById("repTipo").value;
    const desde=document.getElementById("repDesde").value;
    const hasta=document.getElementById("repHasta").value;
    if(!comercial||!desde||!hasta)return NOC.App.alertMessage("Faltan datos","Selecciona comercial y ambas fechas.","error");
    if(desde>hasta)return NOC.App.alertMessage("Periodo incorrecto","La fecha de inicio no puede ser posterior a la fecha fin.","error");

    const tabla=tipo==="facturado"?"facturas":"proformas";
    const etiqueta=tipo==="facturado"?"Facturado":"Proformado";
    NOC.App.showProgress("Generando informe…",`${etiqueta} · ${comercial}`);
    try{
      const {data,error}=await NOC.API.db().from(tabla)
        .select("id,numero,fecha,base_imponible,iva,recargo,total,clientes!inner(nombre_tienda,comercial)")
        .eq("clientes.comercial",comercial).gte("fecha",desde).lte("fecha",hasta)
        .order("fecha",{ascending:true}).order("numero",{ascending:true});
      if(error)throw error;
      currentRows=data||[];
      currentCriteria={report:"comercial",comercial,tipo,etiqueta,desde,hasta};
      NOC.App.hideProgress();
      drawCommercialResult();
    }catch(e){
      NOC.App.hideProgress();
      NOC.App.alertMessage("Error al generar informe","No se ha podido obtener el informe. "+(e.message||e),"error");
    }
  }

  async function generarVentas(){
    const tipo=document.getElementById("ventasTipo").value;
    const desde=document.getElementById("ventasDesde").value;
    const hasta=document.getElementById("ventasHasta").value;
    if(!desde||!hasta)return NOC.App.alertMessage("Faltan datos","Selecciona fecha de inicio y fecha fin.","error");
    if(desde>hasta)return NOC.App.alertMessage("Periodo incorrecto","La fecha de inicio no puede ser posterior a la fecha fin.","error");

    const etiquetas={mayorista:"Mayorista",particulares:"Particulares",todas:"Todas las ventas"};
    NOC.App.showProgress("Generando informe de ventas…",`${etiquetas[tipo]} · ${dateEs(desde)} a ${dateEs(hasta)}`);
    try{
      const {data,error}=await NOC.API.db().from("facturas")
        .select("id,numero,fecha,base_imponible,iva,recargo,total,proforma_id,observaciones,clientes(nombre,apellidos,nombre_tienda,localidad_facturacion),proformas(numero)")
        .gte("fecha",desde).lte("fecha",hasta)
        .order("fecha",{ascending:true}).order("numero",{ascending:true});
      if(error)throw error;

      const esParticular=r=>String(r.clientes?.nombre_tienda||"").trim().toLocaleLowerCase("es")==="particular";
      let rows=data||[];
      if(tipo==="mayorista")rows=rows.filter(r=>!esParticular(r));
      if(tipo==="particulares")rows=rows.filter(esParticular);

      currentRows=rows;
      currentCriteria={report:"ventas",tipo,tipoEtiqueta:etiquetas[tipo],desde,hasta};
      NOC.App.hideProgress();
      drawVentasResult();
    }catch(e){
      NOC.App.hideProgress();
      NOC.App.alertMessage("Error al generar informe","No se ha podido obtener el informe de ventas. "+(e.message||e),"error");
    }
  }

  function drawCommercialResult(){
    const box=document.getElementById("reportResult");
    const t=totals(currentRows),c=currentCriteria;
    box.style.display="";
    box.innerHTML=`
      <div class="report-head">
        <div><h2 style="margin-bottom:5px">Informe por comercial</h2><div class="muted"><strong>${NOC.App.esc(c.comercial)}</strong> · ${c.etiqueta} · ${dateEs(c.desde)} a ${dateEs(c.hasta)}</div></div>
        <div class="toolbar-right"><button class="btn" onclick="NOC.Informes.exportCsv()">Exportar CSV</button><button class="btn btn-primary" onclick="NOC.Informes.imprimir()">Imprimir / Guardar PDF</button></div>
      </div>
      <div class="table-wrap report-table-wrap"><table class="report-table">
        <thead><tr><th>Fecha</th><th>Nº ${c.tipo==="facturado"?"factura":"proforma"}</th><th>Tienda</th><th class="num">Base</th><th class="num">IVA</th><th class="num">RE</th><th class="num">Total</th></tr></thead>
        <tbody>${currentRows.map(r=>`<tr><td>${dateEs(r.fecha)}</td><td><strong>${NOC.App.esc(r.numero)}</strong></td><td>${NOC.App.esc(r.clientes?.nombre_tienda||"")}</td><td class="num">${NOC.App.money(r.base_imponible)}</td><td class="num">${NOC.App.money(r.iva)}</td><td class="num">${NOC.App.money(r.recargo)}</td><td class="num"><strong>${NOC.App.money(r.total)}</strong></td></tr>`).join("") || `<tr><td colspan="7" class="empty">No hay documentos para este comercial en el periodo seleccionado.</td></tr>`}</tbody>
        ${currentRows.length?`<tfoot><tr class="report-total-row"><td colspan="3"><strong>TOTALES</strong></td><td class="num"><strong>${NOC.App.money(t.base)}</strong></td><td class="num"><strong>${NOC.App.money(t.iva)}</strong></td><td class="num"><strong>${NOC.App.money(t.re)}</strong></td><td class="num"><strong>${NOC.App.money(t.total)}</strong></td></tr></tfoot>`:""}
      </table></div><div class="report-count muted">${currentRows.length} documento(s)</div>`;
    box.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function webDato(r,campo){
    if(!String(r?.numero||"").toUpperCase().startsWith("WEB"))return "";
    const obs=String(r?.observaciones||"");
    const rx=new RegExp("(?:^|·)\\s*"+campo+":\\s*([^·]+)","i");
    return (obs.match(rx)||[])[1]?.trim()||"";
  }
  function clienteNombre(c,r){
    const web=webDato(r,"Cliente");
    if(web)return web;
    const personal=[c?.nombre,c?.apellidos].filter(Boolean).join(" ").trim();
    return personal||c?.nombre_tienda||"";
  }
  function clienteLocalidad(c,r){
    return webDato(r,"Localidad")||c?.localidad_facturacion||"";
  }

  function drawVentasResult(){
    const box=document.getElementById("reportResult");
    const t=totals(currentRows),c=currentCriteria;
    box.style.display="";
    box.innerHTML=`
      <div class="report-head">
        <div>
          <div class="report-brand">NOC THE BRAND</div>
          <h2 style="margin:2px 0 5px">Informe de ventas · ${NOC.App.esc(c.tipoEtiqueta)}</h2>
          <div class="muted">${dateEs(c.desde)} a ${dateEs(c.hasta)}</div>
        </div>
        <div class="toolbar-right"><button class="btn" onclick="NOC.Informes.exportCsv()">Exportar CSV</button><button class="btn btn-primary" onclick="NOC.Informes.imprimir()">Imprimir / Guardar PDF</button></div>
      </div>
      <div class="table-wrap report-table-wrap"><table class="report-table report-sales-table">
        <thead><tr>
          <th>Fecha</th><th>Num Factura</th><th>Cliente</th><th>Localidad</th>
          <th class="num">Base</th><th class="num">IVA</th><th class="num">RE</th><th class="num">Total</th>
          <th>Num Prof</th><th>Tienda</th>
        </tr></thead>
        <tbody>${currentRows.map(r=>`<tr>
          <td>${dateEs(r.fecha)}</td>
          <td><strong>${NOC.App.esc(r.numero)}</strong></td>
          <td>${NOC.App.esc(clienteNombre(r.clientes,r))}</td>
          <td>${NOC.App.esc(clienteLocalidad(r.clientes,r))}</td>
          <td class="num">${NOC.App.money(r.base_imponible)}</td>
          <td class="num">${NOC.App.money(r.iva)}</td>
          <td class="num">${NOC.App.money(r.recargo)}</td>
          <td class="num"><strong>${NOC.App.money(r.total)}</strong></td>
          <td>${NOC.App.esc(r.proformas?.numero||"")}</td>
          <td>${NOC.App.esc(r.clientes?.nombre_tienda||"")}</td>
        </tr>`).join("") || `<tr><td colspan="10" class="empty">No hay facturas en el periodo seleccionado.</td></tr>`}</tbody>
        ${currentRows.length?`<tfoot><tr class="report-total-row">
          <td colspan="4"><strong>TOTALES</strong></td>
          <td class="num"><strong>${NOC.App.money(t.base)}</strong></td>
          <td class="num"><strong>${NOC.App.money(t.iva)}</strong></td>
          <td class="num"><strong>${NOC.App.money(t.re)}</strong></td>
          <td class="num"><strong>${NOC.App.money(t.total)}</strong></td>
          <td colspan="2"></td>
        </tr></tfoot>`:""}
      </table></div><div class="report-count muted">${currentRows.length} factura(s)</div>`;
    box.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function exportCsv(){
    if(!currentCriteria||!currentRows.length)return NOC.App.alertMessage("Sin datos","No hay registros que exportar.","info");
    if(currentCriteria.report==="fiscal3000"){
      const headers=["Tienda","Cliente","CIF/NIF","Localidad","Provincia","Nº facturas","Base","IVA","RE","Total"];
      const lines=[headers.map(csvCell).join(";")];
      currentRows.forEach(r=>lines.push([r.tienda,r.cliente,r.cif,r.localidad,r.provincia,r.facturas,
        r.base.toFixed(2).replace(".",","),r.iva.toFixed(2).replace(".",","),r.re.toFixed(2).replace(".",","),r.total.toFixed(2).replace(".",",")
      ].map(csvCell).join(";")));
      downloadBlob(`puntos_venta_mas_${currentCriteria.minimo}_${currentCriteria.year}.csv`,"\uFEFF"+lines.join("\r\n"),"text/csv;charset=utf-8");
      return NOC.App.alertMessage("Exportación finalizada",`${currentRows.length} punto(s) de venta exportados.`,"success");
    }

    if(currentCriteria.report==="articulos"){
      const headers=["Artículo","SKU","Tipo","Fábrica","Unidades vendidas","Importe facturado"];
      const lines=[headers.map(csvCell).join(";")];
      currentRows.forEach(r=>lines.push([
        r.articulo,r.sku,r.tipo,r.fabrica,
        Number(r.unidades||0).toString().replace(".",","),
        Number(r.facturado||0).toFixed(2).replace(".",",")
      ].map(csvCell).join(";")));
      const totalU=currentRows.reduce((a,r)=>a+Number(r.unidades||0),0);
      const totalF=currentRows.reduce((a,r)=>a+Number(r.facturado||0),0);
      lines.push(["","","","TOTALES",String(totalU).replace(".",","),totalF.toFixed(2).replace(".",",")].map(csvCell).join(";"));
      downloadBlob(`informe_articulos_${currentCriteria.desde||"inicio"}_${currentCriteria.hasta||"fin"}.csv`,"\uFEFF"+lines.join("\r\n"),"text/csv;charset=utf-8");
      return NOC.App.alertMessage("Exportación finalizada",`${currentRows.length} artículo(s) exportados a CSV.`,"success");
    }

    const t=totals(currentRows);

    if(currentCriteria.report==="ventas"){
      const headers=["Fecha","Num Factura","Cliente","Localidad","Base","IVA","RE","Total","Num Prof","Tienda"];
      const lines=[headers.map(csvCell).join(";")];
      currentRows.forEach(r=>lines.push([
        dateEs(r.fecha),r.numero,clienteNombre(r.clientes,r),clienteLocalidad(r.clientes,r),
        Number(r.base_imponible||0).toFixed(2).replace(".",","),
        Number(r.iva||0).toFixed(2).replace(".",","),
        Number(r.recargo||0).toFixed(2).replace(".",","),
        Number(r.total||0).toFixed(2).replace(".",","),
        r.proformas?.numero||"",r.clientes?.nombre_tienda||""
      ].map(csvCell).join(";")));
      lines.push(["","","","TOTALES",
        t.base.toFixed(2).replace(".",","),t.iva.toFixed(2).replace(".",","),
        t.re.toFixed(2).replace(".",","),t.total.toFixed(2).replace(".",","),"",""
      ].map(csvCell).join(";"));
      downloadBlob(`informe_ventas_${currentCriteria.tipo}_${currentCriteria.desde}_${currentCriteria.hasta}.csv`,"\uFEFF"+lines.join("\r\n"),"text/csv;charset=utf-8");
      return NOC.App.alertMessage("Exportación finalizada",`${currentRows.length} factura(s) exportadas a CSV.`,"success");
    }

    const c=currentCriteria;
    const headers=["Fecha",`Nº ${c.tipo==="facturado"?"factura":"proforma"}`,"Tienda","Base","IVA","RE","Total"];
    const lines=[headers.map(csvCell).join(";")];
    currentRows.forEach(r=>lines.push([
      dateEs(r.fecha),r.numero,r.clientes?.nombre_tienda||"",
      Number(r.base_imponible||0).toFixed(2).replace(".",","),
      Number(r.iva||0).toFixed(2).replace(".",","),
      Number(r.recargo||0).toFixed(2).replace(".",","),
      Number(r.total||0).toFixed(2).replace(".",",")
    ].map(csvCell).join(";")));
    lines.push(["","","TOTALES",t.base.toFixed(2).replace(".",","),t.iva.toFixed(2).replace(".",","),t.re.toFixed(2).replace(".",","),t.total.toFixed(2).replace(".",",")].map(csvCell).join(";"));
    const safe=c.comercial.replace(/[^\p{L}\p{N}_-]+/gu,"_");
    downloadBlob(`informe_${c.tipo}_${safe}_${c.desde}_${c.hasta}.csv`,"\uFEFF"+lines.join("\r\n"),"text/csv;charset=utf-8");
    NOC.App.alertMessage("Exportación finalizada",`${currentRows.length} documento(s) exportados a CSV.`,"success");
  }

  function imprimir(){
    if(!currentCriteria||!currentRows.length)return NOC.App.alertMessage("Sin datos","No hay registros que imprimir.","info");
    const t=totals(currentRows),c=currentCriteria;
    const w=window.open("","_blank","width=1200,height=800");
    if(!w)return NOC.App.alertMessage("Ventana bloqueada","Permite ventanas emergentes para imprimir el informe.","error");

    if(c.report==="fiscal3000"){
      const body=currentRows.map(r=>`<tr><td>${NOC.App.esc(r.tienda)}</td><td>${NOC.App.esc(r.cliente)}</td><td>${NOC.App.esc(r.cif)}</td><td>${NOC.App.esc(r.localidad)}</td><td>${NOC.App.esc(r.provincia)}</td><td class="n">${r.facturas}</td><td class="n">${NOC.App.money(r.base)}</td><td class="n">${NOC.App.money(r.iva)}</td><td class="n">${NOC.App.money(r.re)}</td><td class="n">${NOC.App.money(r.total)}</td></tr>`).join("");
      w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Puntos de venta +3.000</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;font-size:9px;color:#171717}.brand{font-size:11px;font-weight:800;letter-spacing:2px}h1{font-size:18px;margin:4px 0 4px}.meta{color:#555;margin-bottom:14px}table{width:100%;border-collapse:collapse}th{background:#eef3cf;text-align:left;padding:6px;border:1px solid #ddd}td{padding:6px;border:1px solid #e3e3e3}.n{text-align:right}</style></head><body><div class="brand">NOC THE BRAND</div><h1>Puntos de venta con más de ${NOC.App.money(c.minimo)} de base</h1><div class="meta">Año ${c.year}</div><table><thead><tr><th>Tienda</th><th>Cliente</th><th>CIF/NIF</th><th>Localidad</th><th>Provincia</th><th>Nº facturas</th><th>Base</th><th>IVA</th><th>RE</th><th>Total</th></tr></thead><tbody>${body}</tbody></table><script>window.onload=()=>window.print();</script></body></html>`);
      return w.document.close();
    }

    if(c.report==="articulos"){
      const totalU=currentRows.reduce((a,r)=>a+Number(r.unidades||0),0);
      const totalF=currentRows.reduce((a,r)=>a+Number(r.facturado||0),0);
      const body=currentRows.map(r=>`<tr><td>${NOC.App.esc(r.articulo)}</td><td>${NOC.App.esc(r.sku)}</td><td>${NOC.App.esc(r.tipo)}</td><td>${NOC.App.esc(r.fabrica)}</td><td class="n">${Number(r.unidades).toLocaleString("es-ES")}</td><td class="n">${NOC.App.money(r.facturado)}</td></tr>`).join("");
      w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe de artículos</title>
      <style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,Helvetica,sans-serif;color:#171717;font-size:10px}.brand{font-size:11px;font-weight:800;letter-spacing:2px;margin-bottom:4px}h1{font-size:20px;margin:0 0 14px}table{width:100%;border-collapse:collapse}th{background:#eef3cf;text-align:left;padding:7px;border:1px solid #d8ddc8}td{padding:7px;border:1px solid #e1e4e7}.n{text-align:right}tfoot td{background:#f4f5f6;border-top:2px solid #111;font-weight:700}</style></head><body>
      <div class="brand">NOC THE BRAND</div><h1>Informe de artículos</h1>
      <table><thead><tr><th>Artículo</th><th>SKU</th><th>Tipo</th><th>Fábrica</th><th>Unidades vendidas</th><th>Importe facturado</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="4">TOTALES</td><td class="n">${totalU.toLocaleString("es-ES")}</td><td class="n">${NOC.App.money(totalF)}</td></tr></tfoot></table>
      <script>window.onload=()=>window.print();</script></body></html>`);
      return w.document.close();
    }

    if(c.report==="ventas"){
      const bodyRows=currentRows.map(r=>`<tr>
        <td>${dateEs(r.fecha)}</td><td>${NOC.App.esc(r.numero)}</td><td>${NOC.App.esc(clienteNombre(r.clientes,r))}</td>
        <td>${NOC.App.esc(clienteLocalidad(r.clientes,r))}</td>
        <td class="n">${NOC.App.money(r.base_imponible)}</td><td class="n">${NOC.App.money(r.iva)}</td>
        <td class="n">${NOC.App.money(r.recargo)}</td><td class="n">${NOC.App.money(r.total)}</td>
        <td>${NOC.App.esc(r.proformas?.numero||"")}</td><td>${NOC.App.esc(r.clientes?.nombre_tienda||"")}</td></tr>`).join("");
      w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe de ventas</title>
      <style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,Helvetica,sans-serif;color:#171717;font-size:9px;margin:0}.brand{font-size:11px;font-weight:800;letter-spacing:2px;margin-bottom:4px}h1{font-size:20px;margin:0 0 5px}.meta{color:#555;margin-bottom:16px}table{width:100%;border-collapse:collapse}th{background:#eef3cf;text-align:left;padding:6px;border:1px solid #d8ddc8;font-size:8px}td{padding:6px;border:1px solid #e1e4e7}.n{text-align:right;white-space:nowrap}tfoot td{background:#f4f5f6;border-top:2px solid #111;font-weight:700}</style></head><body>
      <div class="brand">NOC THE BRAND</div><h1>Informe de ventas · ${NOC.App.esc(c.tipoEtiqueta)}</h1><div class="meta">${dateEs(c.desde)} a ${dateEs(c.hasta)}</div>
      <table><thead><tr><th>Fecha</th><th>Num Factura</th><th>Cliente</th><th>Localidad</th><th>Base</th><th>IVA</th><th>RE</th><th>Total</th><th>Num Prof</th><th>Tienda</th></tr></thead>
      <tbody>${bodyRows}</tbody><tfoot><tr><td colspan="4">TOTALES</td><td class="n">${NOC.App.money(t.base)}</td><td class="n">${NOC.App.money(t.iva)}</td><td class="n">${NOC.App.money(t.re)}</td><td class="n">${NOC.App.money(t.total)}</td><td colspan="2"></td></tr></tfoot></table>
      <script>window.onload=()=>window.print();</script></body></html>`);
      return w.document.close();
    }

    const bodyRows=currentRows.map(r=>`<tr><td>${dateEs(r.fecha)}</td><td>${NOC.App.esc(r.numero)}</td><td>${NOC.App.esc(r.clientes?.nombre_tienda||"")}</td><td class="n">${NOC.App.money(r.base_imponible)}</td><td class="n">${NOC.App.money(r.iva)}</td><td class="n">${NOC.App.money(r.recargo)}</td><td class="n"><strong>${NOC.App.money(r.total)}</strong></td></tr>`).join("");
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe ${NOC.App.esc(c.comercial)}</title>
      <style>@page{size:A4 landscape;margin:14mm}body{font-family:Arial,Helvetica,sans-serif;color:#171717;font-size:11px;margin:0}h1{font-size:22px;margin:0 0 5px}.meta{color:#555;margin-bottom:20px}table{width:100%;border-collapse:collapse}th{background:#eef3cf;text-align:left;padding:8px;border:1px solid #d8ddc8;font-size:10px}td{padding:8px;border:1px solid #e1e4e7}.n{text-align:right;white-space:nowrap}tfoot td{background:#f4f5f6;border-top:2px solid #111;font-weight:700}</style></head><body>
      <h1>Informe por comercial</h1><div class="meta"><strong>${NOC.App.esc(c.comercial)}</strong> · ${c.etiqueta} · ${dateEs(c.desde)} a ${dateEs(c.hasta)}</div>
      <table><thead><tr><th>Fecha</th><th>Nº ${c.tipo==="facturado"?"factura":"proforma"}</th><th>Tienda</th><th>Base</th><th>IVA</th><th>RE</th><th>Total</th></tr></thead><tbody>${bodyRows}</tbody><tfoot><tr><td colspan="3">TOTALES</td><td class="n">${NOC.App.money(t.base)}</td><td class="n">${NOC.App.money(t.iva)}</td><td class="n">${NOC.App.money(t.re)}</td><td class="n">${NOC.App.money(t.total)}</td></tr></tfoot></table>
      <script>window.onload=()=>window.print();</script></body></html>`);
    w.document.close();
  }

  return{render,cambiarInforme,generarComercial,generarVentas,generarArticulos,generarFiscal3000,exportCsv,imprimir};
})();