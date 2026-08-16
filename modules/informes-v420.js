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
            <button class="btn ${currentReport==="proformas"?"btn-primary":""}" onclick="NOC.Informes.cambiarInforme('proformas')">Proformas</button>
            <button class="btn ${currentReport==="clientes"?"btn-primary":""}" onclick="NOC.Informes.cambiarInforme('clientes')">Clientes</button>
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
    else if(currentReport==="proformas")await drawProformasFilters();
    else if(currentReport==="clientes")await drawClientesFilters();
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



  const clienteColumnDefs={
    tienda:{label:"Tienda"},
    cliente:{label:"Cliente"},
    localidad:{label:"Localidad"},
    provincia:{label:"Provincia"},
    comercial:{label:"Comercial"},
    fiscal:{label:"Fiscal"},
    ultimaProforma:{label:"Última proforma"},
    fechaProforma:{label:"Fecha últ. proforma"},
    ultimaFactura:{label:"Última factura"}
  };

  function clienteValue(r,key){return r?.[key]??""}
  function clienteSortRows(rows,key,dir){
    return [...rows].sort((a,b)=>{
      const av=clienteValue(a,key),bv=clienteValue(b,key);
      const cmp=String(av??"").localeCompare(String(bv??""),"es",{numeric:true,sensitivity:"base"});
      return dir==="desc"?-cmp:cmp;
    });
  }
  function clienteCellHtml(r,key){
    const v=clienteValue(r,key);
    if(["fechaProforma","fechaFactura","ultimaActividad"].includes(key))return dateEs(v);
    return NOC.App.esc(v);
  }

  async function drawClientesFilters(){
    let clientes=[];
    try{clientes=await NOC.API.list("clientes",{order:"nombre_tienda",ascending:true})}catch(e){}
    const uniq=k=>[...new Set(clientes.map(c=>String(c[k]||"").trim()).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"}));
    const localidades=uniq("localidad_facturacion"),provincias=uniq("provincia_facturacion"),
          comerciales=uniq("comercial"),fiscales=uniq("tipo_fiscal");

    document.getElementById("reportFilters").innerHTML=`
      <h2>Informe general de Clientes</h2>
      <p class="muted">Consulta tu cartera de clientes y cuándo fue su última actividad. Las fechas Desde/Hasta son inclusivas.</p>
      <form id="reportClientesForm" class="form-grid" onsubmit="event.preventDefault();NOC.Informes.generarClientes()">
        <div class="field f3"><label>Buscar tienda / cliente</label><input id="cliRepTexto" placeholder="Nombre, tienda…"></div>
        <div class="field f3"><label>Zona</label><select id="cliRepZona"><option value="">Todas</option><option value="canarias">Canarias</option><option value="no_canarias">No Canarias</option></select></div>
        <div class="field f3"><label>Localidad</label><select id="cliRepLocalidad"><option value="">Todas</option>${localidades.map(x=>`<option>${NOC.App.esc(x)}</option>`).join("")}</select></div>
        <div class="field f3"><label>Provincia</label><select id="cliRepProvincia"><option value="">Todas</option>${provincias.map(x=>`<option>${NOC.App.esc(x)}</option>`).join("")}</select></div>

        <div class="field f3"><label>Comercial</label><select id="cliRepComercial"><option value="">Todos</option>${comerciales.map(x=>`<option>${NOC.App.esc(x)}</option>`).join("")}</select></div>
        <div class="field f3"><label>Tipo fiscal</label><select id="cliRepFiscal"><option value="">Todos</option>${fiscales.map(x=>`<option>${NOC.App.esc(x)}</option>`).join("")}</select></div>
        <div class="field f3"><label>Actividad</label><select id="cliRepActividad"><option value="">Todos</option><option value="con">Con proforma o factura</option><option value="sin">Sin actividad</option></select></div>
        <div class="field f3"><label>Última compra desde</label><input id="cliRepDesde" type="date"></div>
        <div class="field f3"><label>Última compra hasta</label><input id="cliRepHasta" type="date"></div>

        <div class="field f3">
          <label>Clientes sin comprar en los últimos</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="cliRepMesesInactivo" type="number" min="1" step="1" value="6" style="max-width:90px">
            <span class="muted">meses</span>
          </div>
        </div>
        <div class="field f3" style="align-self:end">
          <button type="button" class="btn" onclick="NOC.Informes.generarClientesInactivos()">Ver clientes inactivos</button>
        </div>

        <div class="field f3"><label>Ordenar por</label><select id="cliRepOrden">${Object.entries(clienteColumnDefs).map(([k,v])=>`<option value="${k}" ${k==="ultimaActividad"?"selected":""}>${NOC.App.esc(v.label)}</option>`).join("")}</select></div>
        <div class="field f3"><label>Orden</label><select id="cliRepDir"><option value="desc">Más reciente / Z–A</option><option value="asc">Más antiguo / A–Z</option></select></div>
        <div class="f12 toolbar" style="margin-top:4px">
          <button type="button" class="btn" onclick="document.getElementById('reportClientesForm').reset();document.getElementById('reportResult').style.display='none'">Limpiar filtros</button>
          <button type="submit" class="btn btn-primary">Generar informe</button>
        </div>
      </form>`;
  }

  function ultimoDocumento(rows){
    if(!rows?.length)return null;
    return [...rows].sort((a,b)=>{
      const fc=String(b.fecha||"").localeCompare(String(a.fecha||""));
      if(fc)return fc;
      return String(b.numero||"").localeCompare(String(a.numero||""),"es",{numeric:true});
    })[0];
  }


  function restarMesesISO(fechaISO,meses){
    const d=fechaISO?new Date(fechaISO+"T12:00:00"):new Date();
    const day=d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth()-Number(meses||0));
    d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));
    return d.toISOString().slice(0,10);
  }

  async function cargarFilasClientes(){
    const [clientes,proformas,facturas]=await Promise.all([
      NOC.API.list("clientes",{order:"nombre_tienda",ascending:true}),
      NOC.API.list("proformas",{select:"id,numero,fecha,cliente_id,estado"}),
      NOC.API.list("facturas",{select:"id,numero,fecha,cliente_id"})
    ]);

    const pMap=new Map(),fMap=new Map();
    for(const p of proformas){
      if(!p.cliente_id)continue;
      if(!pMap.has(p.cliente_id))pMap.set(p.cliente_id,[]);
      pMap.get(p.cliente_id).push(p);
    }
    for(const f of facturas){
      if(!f.cliente_id)continue;
      if(!fMap.has(f.cliente_id))fMap.set(f.cliente_id,[]);
      fMap.get(f.cliente_id).push(f);
    }

    return clientes.map(c=>{
      const up=ultimoDocumento(pMap.get(c.id)||[]);
      const uf=ultimoDocumento(fMap.get(c.id)||[]);
      let ultima="",tipo="";
      if(up?.fecha||uf?.fecha){
        if(!uf?.fecha || (up?.fecha&&up.fecha>uf.fecha)){ultima=up.fecha;tipo="Proforma"}
        else if(!up?.fecha || uf.fecha>up.fecha){ultima=uf.fecha;tipo="Factura"}
        else{ultima=uf.fecha||up.fecha;tipo="Factura"}
      }
      return{
        tienda:c.nombre_tienda||"",
        cliente:[c.nombre,c.apellidos].filter(Boolean).join(" "),
        localidad:c.localidad_facturacion||"",
        provincia:c.provincia_facturacion||"",
        comercial:c.comercial||"",
        fiscal:c.tipo_fiscal||"",
        ultimaProforma:up?.numero||"",
        fechaProforma:up?.fecha||"",
        ultimaFactura:uf?.numero||"",
        fechaFactura:uf?.fecha||"",
        ultimaActividad:ultima,
        tipoActividad:tipo
      };
    });
  }

  async function generarClientesInactivos(){
    const meses=Math.max(1,Number(document.getElementById("cliRepMesesInactivo")?.value||6));
    const limite=restarMesesISO(new Date().toISOString().slice(0,10),meses);

    NOC.App.showProgress("Generando informe…",`Clientes sin compras en ${meses} meses`);
    try{
      let rows=await cargarFilasClientes();
      rows=rows.filter(r=>!r.ultimaActividad || r.ultimaActividad<limite);
      rows=[...rows].sort((a,b)=>{
        if(!a.ultimaActividad&&!b.ultimaActividad)return String(a.tienda).localeCompare(String(b.tienda),"es");
        if(!a.ultimaActividad)return -1;
        if(!b.ultimaActividad)return 1;
        return String(a.ultimaActividad).localeCompare(String(b.ultimaActividad));
      });
      currentRows=rows;
      currentCriteria={report:"clientes_inactivos",meses,limite};
      NOC.App.hideProgress();
      drawClientesInactivosResult();
    }catch(e){
      NOC.App.hideProgress();
      NOC.App.alertMessage("Error al generar informe",String(e?.message||e||"Error desconocido"),"error");
    }
  }

  function drawClientesInactivosResult(){
    const box=document.getElementById("reportResult"),c=currentCriteria;
    const cols=["tienda","ultimaProforma","fechaProforma","ultimaFactura"];
    box.style.display="";
    box.innerHTML=`
      <div class="report-head">
        <div>
          <div class="report-brand">NOC THE BRAND</div>
          <h2 style="margin:2px 0 5px">Clientes sin compras en los últimos ${c.meses} meses</h2>
          <div class="muted">Sin actividad desde ${dateEs(c.limite)} · ${currentRows.length} cliente(s)</div>
        </div>
        <div class="toolbar-right">
          <button class="btn" onclick="NOC.Informes.exportCsv()">Exportar CSV</button>
          <button class="btn btn-primary" onclick="NOC.Informes.imprimir()">Imprimir / Guardar PDF</button>
        </div>
      </div>
      <div class="table-wrap report-table-wrap"><table class="report-table">
        <thead><tr>${cols.map(k=>`<th>${NOC.App.esc(clienteColumnDefs[k]?.label||k)}</th>`).join("")}</tr></thead>
        <tbody>${currentRows.map(r=>`<tr>
          <td>${NOC.App.esc(r.tienda)}</td>
          <td>${NOC.App.esc(r.ultimaProforma)}</td>
          <td>${dateEs(r.fechaProforma)}</td>
          <td>${NOC.App.esc(r.ultimaFactura)}</td>
        </tr>`).join("")||`<tr><td colspan="4" class="empty">No hay clientes inactivos para ese periodo.</td></tr>`}</tbody>
      </table></div>`;
    box.scrollIntoView({behavior:"smooth",block:"start"});
  }

  async function generarClientes(){
    const v=id=>document.getElementById(id)?.value||"";
    const texto=v("cliRepTexto").trim().toLocaleLowerCase("es");
    const zona=v("cliRepZona"),localidad=v("cliRepLocalidad"),provincia=v("cliRepProvincia"),
          comercial=v("cliRepComercial"),fiscal=v("cliRepFiscal"),actividad=v("cliRepActividad"),
          desde=v("cliRepDesde"),hasta=v("cliRepHasta"),orden=v("cliRepOrden")||"ultimaActividad",
          dir=v("cliRepDir")||"desc";
    if(desde&&hasta&&desde>hasta)return NOC.App.alertMessage("Periodo incorrecto","La fecha Desde no puede ser posterior a Hasta.","error");

    NOC.App.showProgress("Generando informe…","Clientes y última actividad");
    try{
      let rows=await cargarFilasClientes();

      rows=rows.filter(r=>{
        const hay=[r.tienda,r.cliente,r.localidad,r.provincia,r.comercial,r.fiscal].join(" ").toLocaleLowerCase("es");
        if(texto&&!hay.includes(texto))return false;
        if(zona==="canarias"&&String(r.fiscal).toLocaleLowerCase("es")!=="canarias")return false;
        if(zona==="no_canarias"&&String(r.fiscal).toLocaleLowerCase("es")==="canarias")return false;
        if(localidad&&r.localidad!==localidad)return false;
        if(provincia&&r.provincia!==provincia)return false;
        if(comercial&&r.comercial!==comercial)return false;
        if(fiscal&&r.fiscal!==fiscal)return false;
        if(actividad==="con"&&!r.ultimaActividad)return false;
        if(actividad==="sin"&&r.ultimaActividad)return false;
        if(desde&&(!r.ultimaActividad||r.ultimaActividad<desde))return false;
        if(hasta&&(!r.ultimaActividad||r.ultimaActividad>hasta))return false;
        return true;
      });

      currentRows=clienteSortRows(rows,orden,dir);
      currentCriteria={report:"clientes",texto,zona,localidad,provincia,comercial,fiscal,actividad,desde,hasta,orden,dir};
      NOC.App.hideProgress();
      drawClientesResult();
    }catch(e){
      NOC.App.hideProgress();
      NOC.App.alertMessage("Error al generar informe",String(e?.message||e||"Error desconocido"),"error");
    }
  }

  function ordenarClientesResultado(key){
    if(!currentCriteria||currentCriteria.report!=="clientes")return;
    if(currentCriteria.orden===key)currentCriteria.dir=currentCriteria.dir==="asc"?"desc":"asc";
    else{currentCriteria.orden=key;currentCriteria.dir="asc"}
    currentRows=clienteSortRows(currentRows,key,currentCriteria.dir);
    const o=document.getElementById("cliRepOrden"),d=document.getElementById("cliRepDir");
    if(o)o.value=key;if(d)d.value=currentCriteria.dir;
    drawClientesResult();
  }

  function drawClientesResult(){
    const box=document.getElementById("reportResult"),c=currentCriteria;
    const cols=Object.keys(clienteColumnDefs);
    const conActividad=currentRows.filter(r=>r.ultimaActividad).length;
    box.style.display="";
    box.innerHTML=`
      <div class="report-head">
        <div><div class="report-brand">NOC THE BRAND</div><h2 style="margin:2px 0 5px">Informe general de Clientes</h2>
        <div class="muted">${currentRows.length} cliente(s) · ${conActividad} con actividad</div></div>
        <div class="toolbar-right"><button class="btn" onclick="NOC.Informes.exportCsv()">Exportar CSV</button><button class="btn btn-primary" onclick="NOC.Informes.imprimir()">Imprimir / Guardar PDF</button></div>
      </div>
      <div class="table-wrap report-table-wrap"><table class="report-table">
        <thead><tr>${cols.map(k=>{const a=c.orden===k;return `<th class="sortable-th ${a?"sort-active":""}" onclick="NOC.Informes.ordenarClientesResultado('${k}')">${NOC.App.esc(clienteColumnDefs[k].label)} <span class="sort-mark">${a?(c.dir==="asc"?"↑":"↓"):"↕"}</span></th>`}).join("")}</tr></thead>
        <tbody>${currentRows.map(r=>`<tr>${cols.map(k=>`<td>${clienteCellHtml(r,k)}</td>`).join("")}</tr>`).join("")||`<tr><td colspan="${cols.length}" class="empty">No hay clientes que coincidan con los filtros.</td></tr>`}</tbody>
      </table></div>`;
    box.scrollIntoView({behavior:"smooth",block:"start"});
  }

  const proformaColumnDefs={
    numero:{label:"Nº proforma"},
    fecha:{label:"Fecha"},
    tienda:{label:"Tienda"},
    comercial:{label:"Comercial"},
    estado:{label:"Estado"},
    pago:{label:"Forma de pago"},
    base:{label:"Base"},
    iva:{label:"IVA"},
    re:{label:"RE"},
    total:{label:"Total"},
    factura:{label:"Factura asociada"}
  };

  function proformaFactura(r){
    const f=r?.facturas;
    if(Array.isArray(f))return f[0]?.numero||"";
    return f?.numero||"";
  }
  function proformaValue(r,key){
    const c=r?.clientes||{};
    if(key==="numero")return r.numero||"";
    if(key==="fecha")return r.fecha||"";
    if(key==="tienda")return c.nombre_tienda||"";
    if(key==="comercial")return c.comercial||"";
    if(key==="estado")return r.estado||"";
    if(key==="pago")return r.forma_pago||"";
    if(key==="base")return Number(r.base_imponible||0);
    if(key==="iva")return Number(r.iva||0);
    if(key==="re")return Number(r.recargo||0);
    if(key==="total")return Number(r.total||0);
    if(key==="factura")return proformaFactura(r);
    return "";
  }
  function proformaCellHtml(r,key){
    const v=proformaValue(r,key);
    if(key==="fecha")return dateEs(v);
    if(["base","iva","re","total"].includes(key))return NOC.App.money(v);
    return NOC.App.esc(v);
  }
  function proformaSortRows(rows,key,dir){
    const numeric=["base","iva","re","total"].includes(key);
    return [...rows].sort((a,b)=>{
      const av=proformaValue(a,key),bv=proformaValue(b,key);
      let cmp=0;
      if(numeric)cmp=Number(av)-Number(bv);
      else cmp=String(av??"").localeCompare(String(bv??""),"es",{numeric:true,sensitivity:"base"});
      return dir==="desc"?-cmp:cmp;
    });
  }

  async function drawProformasFilters(){
    let clientes=[],docs=[];
    try{
      [clientes,docs]=await Promise.all([
        NOC.API.list("clientes",{select:"id,nombre_tienda",order:"nombre_tienda",ascending:true}),
        NOC.API.list("proformas",{select:"numero,forma_pago",order:"numero",ascending:true})
      ]);
    }catch(e){}
    const numeros=[...new Set((docs||[]).map(r=>String(r.numero||"").trim()).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,"es",{numeric:true,sensitivity:"base"}));
    const pagos=[...new Set((docs||[]).map(r=>String(r.forma_pago||"").trim()).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"}));
    const colsDefault=["numero","fecha","tienda","estado","pago","base","iva","re","total","factura"];

    document.getElementById("reportFilters").innerHTML=`
      <h2>Informe avanzado de Proformas</h2>
      <p class="muted">Combina los filtros que necesites. Las fechas, numeraciones e importes Desde/Hasta son inclusivos.</p>
      <form id="reportProformasForm" class="form-grid" onsubmit="event.preventDefault();NOC.Informes.generarProformas()">
        <div class="field f3">
          <label>Tienda</label>
          <select id="profRepTienda">
            <option value="">Todas las tiendas</option>
            ${(clientes||[]).map(c=>`<option value="${NOC.App.esc(c.id)}">${NOC.App.esc(c.nombre_tienda||"Sin nombre")}</option>`).join("")}
          </select>
        </div>
        <div class="field f3"><label>Fecha desde</label><input id="profRepDesde" type="date"></div>
        <div class="field f3"><label>Fecha hasta</label><input id="profRepHasta" type="date"></div>
        <div class="field f3">
          <label>Estado</label>
          <select id="profRepEstado"><option value="">Todos</option><option>Enviada</option><option>Facturada</option><option>Cancelada</option></select>
        </div>

        <div class="field f3">
          <label>Nº proforma desde</label>
          <select id="profRepNumDesde"><option value="">Primera</option>${numeros.map(n=>`<option value="${NOC.App.esc(n)}">${NOC.App.esc(n)}</option>`).join("")}</select>
        </div>
        <div class="field f3">
          <label>Nº proforma hasta</label>
          <select id="profRepNumHasta"><option value="">Última</option>${numeros.map(n=>`<option value="${NOC.App.esc(n)}">${NOC.App.esc(n)}</option>`).join("")}</select>
        </div>
        <div class="field f3">
          <label>Forma de pago</label>
          <select id="profRepPago"><option value="">Todas</option>${pagos.map(p=>`<option value="${NOC.App.esc(p)}">${NOC.App.esc(p)}</option>`).join("")}</select>
        </div>
        <div class="field f3">
          <label>RE</label>
          <select id="profRepRE"><option value="">Con y sin RE</option><option value="con">Sólo con RE</option><option value="sin">Sólo sin RE</option></select>
        </div>

        <div class="field f3">
          <label>IVA</label>
          <select id="profRepIVA"><option value="">Con y sin IVA</option><option value="con">Sólo con IVA</option><option value="sin">Sólo sin IVA</option></select>
        </div>
        <div class="field f3"><label>Importe total mínimo</label><input id="profRepMin" type="number" step="0.01" placeholder="Sin mínimo"></div>
        <div class="field f3"><label>Importe total máximo</label><input id="profRepMax" type="number" step="0.01" placeholder="Sin máximo"></div>
        <div class="field f3">
          <label>Ordenar por</label>
          <select id="profRepOrden">${Object.entries(proformaColumnDefs).map(([k,d])=>`<option value="${k}" ${k==="fecha"?"selected":""}>${NOC.App.esc(d.label)}</option>`).join("")}</select>
        </div>
        <div class="field f3">
          <label>Orden</label>
          <select id="profRepDir"><option value="asc">Menor / A–Z</option><option value="desc">Mayor / Z–A</option></select>
        </div>

        <div class="field f12">
          <label>Columnas a mostrar</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px 18px;padding:10px 0">
            ${Object.entries(proformaColumnDefs).map(([k,d])=>`
              <label style="display:inline-flex;align-items:center;gap:7px;font-weight:500;margin:0">
                <input class="prof-rep-col" type="checkbox" value="${k}" ${colsDefault.includes(k)?"checked":""} style="width:16px;height:16px;min-height:16px">
                ${NOC.App.esc(d.label)}
              </label>`).join("")}
          </div>
        </div>

        <div class="f12 toolbar" style="margin:4px 0 0">
          <button class="btn" type="button" onclick="NOC.Informes.limpiarProformas()">Limpiar filtros</button>
          <button class="btn btn-primary" type="submit">Generar informe</button>
        </div>
      </form>`;
  }

  function limpiarProformas(){
    const f=document.getElementById("reportProformasForm");
    if(!f)return;
    f.reset();
    document.querySelectorAll(".prof-rep-col").forEach(el=>el.checked=["numero","fecha","tienda","estado","pago","base","iva","re","total","factura"].includes(el.value));
    document.getElementById("reportResult").style.display="none";
    currentRows=[];currentCriteria=null;
  }

  async function generarProformas(){
    const val=id=>document.getElementById(id)?.value||"";
    const tienda=val("profRepTienda");
    const desde=val("profRepDesde"),hasta=val("profRepHasta");
    const numDesde=val("profRepNumDesde"),numHasta=val("profRepNumHasta");
    const estado=val("profRepEstado"),pago=val("profRepPago");
    const re=val("profRepRE"),iva=val("profRepIVA");
    const minTxt=val("profRepMin"),maxTxt=val("profRepMax");
    const min=minTxt===""?null:Number(minTxt),max=maxTxt===""?null:Number(maxTxt);
    const orden=val("profRepOrden")||"fecha",dir=val("profRepDir")||"asc";
    const columns=[...document.querySelectorAll(".prof-rep-col:checked")].map(el=>el.value);

    if(desde&&hasta&&desde>hasta)return NOC.App.alertMessage("Periodo incorrecto","La fecha Desde no puede ser posterior a Hasta.","error");
    if(numDesde&&numHasta&&numDesde.localeCompare(numHasta,"es",{numeric:true})>0)return NOC.App.alertMessage("Numeración incorrecta","La proforma Desde no puede ser posterior a Hasta.","error");
    if(min!==null&&max!==null&&min>max)return NOC.App.alertMessage("Importe incorrecto","El importe mínimo no puede ser mayor que el máximo.","error");
    if(!columns.length)return NOC.App.alertMessage("Sin columnas","Selecciona al menos una columna para el informe.","error");

    NOC.App.showProgress("Generando informe…","Proformas");
    try{
      let q=NOC.API.db().from("proformas")
        .select("id,numero,fecha,estado,forma_pago,base_imponible,iva,recargo,total,cliente_id,clientes(nombre_tienda,comercial),facturas(numero)");
      if(tienda)q=q.eq("cliente_id",tienda);
      if(desde)q=q.gte("fecha",desde);
      if(hasta)q=q.lte("fecha",hasta);
      if(numDesde)q=q.gte("numero",numDesde);
      if(numHasta)q=q.lte("numero",numHasta);
      if(estado)q=q.eq("estado",estado);
      if(pago)q=q.eq("forma_pago",pago);
      if(re==="con")q=q.gt("recargo",0);
      if(re==="sin")q=q.eq("recargo",0);
      if(iva==="con")q=q.gt("iva",0);
      if(iva==="sin")q=q.eq("iva",0);
      if(min!==null)q=q.gte("total",min);
      if(max!==null)q=q.lte("total",max);

      const {data,error}=await q;
      if(error)throw error;
      currentRows=proformaSortRows(data||[],orden,dir);
      currentCriteria={
        report:"proformas",tienda,desde,hasta,numDesde,numHasta,estado,pago,re,iva,min,max,
        orden,dir,columns
      };
      NOC.App.hideProgress();
      drawProformasResult();
    }catch(e){
      NOC.App.hideProgress();
      NOC.App.alertMessage("Error al generar informe","No se ha podido obtener el informe de proformas. "+(e.message||e),"error");
    }
  }

  function ordenarProformasResultado(key){
    if(!currentCriteria||currentCriteria.report!=="proformas")return;
    if(currentCriteria.orden===key)currentCriteria.dir=currentCriteria.dir==="asc"?"desc":"asc";
    else{currentCriteria.orden=key;currentCriteria.dir="asc";}
    currentRows=proformaSortRows(currentRows,key,currentCriteria.dir);
    const ordenEl=document.getElementById("profRepOrden"),dirEl=document.getElementById("profRepDir");
    if(ordenEl)ordenEl.value=key;
    if(dirEl)dirEl.value=currentCriteria.dir;
    drawProformasResult();
  }

  function drawProformasResult(){
    const box=document.getElementById("reportResult"),c=currentCriteria;
    const t=totals(currentRows);
    const cols=c.columns||[];
    const resumen=[
      c.desde||c.hasta?`Fechas: ${c.desde?dateEs(c.desde):"inicio"} a ${c.hasta?dateEs(c.hasta):"fin"}`:"",
      c.numDesde||c.numHasta?`Numeración: ${c.numDesde||"primera"} a ${c.numHasta||"última"}`:"",
      c.estado?`Estado: ${c.estado}`:"",
      c.pago?`Pago: ${c.pago}`:"",
      c.re?`RE: ${c.re==="con"?"con RE":"sin RE"}`:"",
      c.iva?`IVA: ${c.iva==="con"?"con IVA":"sin IVA"}`:"",
      c.min!==null||c.max!==null?`Importe: ${c.min!==null?NOC.App.money(c.min):"sin mínimo"} a ${c.max!==null?NOC.App.money(c.max):"sin máximo"}`:""
    ].filter(Boolean).join(" · ")||"Todas las proformas";

    box.style.display="";
    box.innerHTML=`
      <div class="report-head">
        <div><div class="report-brand">NOC THE BRAND</div><h2 style="margin:2px 0 5px">Informe avanzado de Proformas</h2><div class="muted">${NOC.App.esc(resumen)}</div></div>
        <div class="toolbar-right"><button class="btn" onclick="NOC.Informes.exportCsv()">Exportar CSV</button><button class="btn btn-primary" onclick="NOC.Informes.imprimir()">Imprimir / Guardar PDF</button></div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0">
        <span class="pill">Proformas: <b>${currentRows.length}</b></span>
        <span class="pill">Base: <b>${NOC.App.money(t.base)}</b></span>
        <span class="pill">IVA: <b>${NOC.App.money(t.iva)}</b></span>
        <span class="pill">RE: <b>${NOC.App.money(t.re)}</b></span>
        <span class="pill">Total: <b>${NOC.App.money(t.total)}</b></span>
      </div>
      <div class="table-wrap report-table-wrap"><table class="report-table">
        <thead><tr>${cols.map(k=>{
          const active=c.orden===k;
          return `<th class="sortable-th ${active?"sort-active":""} ${["base","iva","re","total"].includes(k)?"num":""}" onclick="NOC.Informes.ordenarProformasResultado('${k}')" title="Ordenar por ${NOC.App.esc(proformaColumnDefs[k]?.label||k)}">${NOC.App.esc(proformaColumnDefs[k]?.label||k)} <span class="sort-mark">${active?(c.dir==="asc"?"↑":"↓"):"↕"}</span></th>`;
        }).join("")}</tr></thead>
        <tbody>${currentRows.map(r=>`<tr>${cols.map(k=>`<td class="${["base","iva","re","total"].includes(k)?"num":""}">${proformaCellHtml(r,k)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}" class="empty">No hay proformas que coincidan con los filtros seleccionados.</td></tr>`}</tbody>
        ${currentRows.length?`<tfoot><tr class="report-total-row">${cols.map((k,i)=>{
          if(k==="base")return `<td class="num"><strong>${NOC.App.money(t.base)}</strong></td>`;
          if(k==="iva")return `<td class="num"><strong>${NOC.App.money(t.iva)}</strong></td>`;
          if(k==="re")return `<td class="num"><strong>${NOC.App.money(t.re)}</strong></td>`;
          if(k==="total")return `<td class="num"><strong>${NOC.App.money(t.total)}</strong></td>`;
          return `<td>${i===0?"<strong>TOTALES</strong>":""}</td>`;
        }).join("")}</tr></tfoot>`:""}
      </table></div>
      <div class="report-count muted">${currentRows.length} proforma(s)</div>`;
    box.scrollIntoView({behavior:"smooth",block:"start"});
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
    if(currentCriteria.report==="clientes_inactivos"){
      const cols=["tienda","ultimaProforma","fechaProforma","ultimaFactura"];
      const lines=[cols.map(k=>csvCell(clienteColumnDefs[k]?.label||k)).join(";")];
      currentRows.forEach(r=>lines.push(cols.map(k=>{
        let val=clienteValue(r,k);
        if(k==="fechaProforma")val=dateEs(val);
        return csvCell(val);
      }).join(";")));
      downloadBlob(`clientes_inactivos_${currentCriteria.meses}_meses_${isoToday()}.csv`,"\uFEFF"+lines.join("\r\n"),"text/csv;charset=utf-8");
      return NOC.App.alertMessage("Exportación finalizada",`${currentRows.length} cliente(s) exportados a CSV.`,"success");
    }

    if(currentCriteria.report==="clientes"){
      const cols=Object.keys(clienteColumnDefs);
      const lines=[cols.map(k=>csvCell(clienteColumnDefs[k].label)).join(";")];
      currentRows.forEach(r=>lines.push(cols.map(k=>{
        let val=clienteValue(r,k);
        if(["fechaProforma","fechaFactura","ultimaActividad"].includes(k))val=dateEs(val);
        return csvCell(val);
      }).join(";")));
      downloadBlob(`informe_clientes_${isoToday()}.csv`,"\uFEFF"+lines.join("\r\n"),"text/csv;charset=utf-8");
      return NOC.App.alertMessage("Exportación finalizada",`${currentRows.length} cliente(s) exportados a CSV.`,"success");
    }

    if(currentCriteria.report==="proformas"){
      const c=currentCriteria,cols=c.columns||[];
      const headers=cols.map(k=>proformaColumnDefs[k]?.label||k);
      const lines=[headers.map(csvCell).join(";")];
      currentRows.forEach(r=>lines.push(cols.map(k=>{
        let v=proformaValue(r,k);
        if(k==="fecha")v=dateEs(v);
        if(["base","iva","re","total"].includes(k))v=Number(v||0).toFixed(2).replace(".",",");
        return csvCell(v);
      }).join(";")));
      const t=totals(currentRows);
      lines.push(cols.map((k,i)=>{
        if(k==="base")return csvCell(t.base.toFixed(2).replace(".",","));
        if(k==="iva")return csvCell(t.iva.toFixed(2).replace(".",","));
        if(k==="re")return csvCell(t.re.toFixed(2).replace(".",","));
        if(k==="total")return csvCell(t.total.toFixed(2).replace(".",","));
        return csvCell(i===0?"TOTALES":"");
      }).join(";"));
      downloadBlob(`informe_proformas_${c.desde||"inicio"}_${c.hasta||"fin"}.csv`,"\uFEFF"+lines.join("\r\n"),"text/csv;charset=utf-8");
      return NOC.App.alertMessage("Exportación finalizada",`${currentRows.length} proforma(s) exportadas a CSV.`,"success");
    }

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

    if(c.report==="clientes_inactivos"){
      const cols=["tienda","ultimaProforma","fechaProforma","ultimaFactura"];
      const th=cols.map(k=>`<th>${NOC.App.esc(clienteColumnDefs[k]?.label||k)}</th>`).join("");
      const body=currentRows.map(r=>`<tr>
        <td>${NOC.App.esc(r.tienda)}</td>
        <td>${NOC.App.esc(r.ultimaProforma)}</td>
        <td>${dateEs(r.fechaProforma)}</td>
        <td>${NOC.App.esc(r.ultimaFactura)}</td>
      </tr>`).join("");
      w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Clientes inactivos</title>
      <style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;font-size:9px;color:#171717}.brand{font-size:11px;font-weight:800;letter-spacing:2px}h1{font-size:18px;margin:4px 0 12px}table{width:100%;border-collapse:collapse}th{background:#eef3cf;text-align:left;padding:6px;border:1px solid #ddd}td{padding:6px;border:1px solid #e3e3e3}</style></head><body>
      <div class="brand">NOC THE BRAND</div><h1>Clientes sin compras en los últimos ${c.meses} meses</h1>
      <table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>
      <script>window.onload=()=>window.print();</script></body></html>`);
      return w.document.close();
    }

    if(c.report==="clientes"){
      const cols=Object.keys(clienteColumnDefs);
      const th=cols.map(k=>`<th>${NOC.App.esc(clienteColumnDefs[k].label)}</th>`).join("");
      const body=currentRows.map(r=>`<tr>${cols.map(k=>`<td>${clienteCellHtml(r,k)}</td>`).join("")}</tr>`).join("");
      w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe de Clientes</title>
      <style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial,sans-serif;font-size:8px;color:#171717}.brand{font-size:11px;font-weight:800;letter-spacing:2px}h1{font-size:18px;margin:4px 0 12px}table{width:100%;border-collapse:collapse}th{background:#eef3cf;text-align:left;padding:5px;border:1px solid #ddd}td{padding:5px;border:1px solid #e3e3e3}</style></head><body>
      <div class="brand">NOC THE BRAND</div><h1>Informe general de Clientes</h1>
      <table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>
      <script>window.onload=()=>window.print();</script></body></html>`);
      return w.document.close();
    }

    if(c.report==="proformas"){
      const cols=c.columns||[];
      const t=totals(currentRows);
      const th=cols.map(k=>`<th>${NOC.App.esc(proformaColumnDefs[k]?.label||k)}</th>`).join("");
      const body=currentRows.map(r=>`<tr>${cols.map(k=>`<td class="${["base","iva","re","total"].includes(k)?"n":""}">${proformaCellHtml(r,k)}</td>`).join("")}</tr>`).join("");
      const foot=cols.map((k,i)=>{
        if(k==="base")return `<td class="n"><strong>${NOC.App.money(t.base)}</strong></td>`;
        if(k==="iva")return `<td class="n"><strong>${NOC.App.money(t.iva)}</strong></td>`;
        if(k==="re")return `<td class="n"><strong>${NOC.App.money(t.re)}</strong></td>`;
        if(k==="total")return `<td class="n"><strong>${NOC.App.money(t.total)}</strong></td>`;
        return `<td>${i===0?"<strong>TOTALES</strong>":""}</td>`;
      }).join("");
      w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe de Proformas</title>
      <style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;font-size:9px;color:#171717}.brand{font-size:11px;font-weight:800;letter-spacing:2px}h1{font-size:18px;margin:4px 0 12px}table{width:100%;border-collapse:collapse}th{background:#eef3cf;text-align:left;padding:6px;border:1px solid #ddd}td{padding:6px;border:1px solid #e3e3e3}.n{text-align:right}tfoot{font-weight:700}</style></head><body>
      <div class="brand">NOC THE BRAND</div><h1>Informe avanzado de Proformas</h1>
      <table><thead><tr>${th}</tr></thead><tbody>${body}</tbody><tfoot><tr>${foot}</tr></tfoot></table>
      <script>window.onload=()=>window.print();</script></body></html>`);
      return w.document.close();
    }

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

  return{render,cambiarInforme,generarComercial,generarVentas,generarProformas,limpiarProformas,ordenarProformasResultado,generarClientes,generarClientesInactivos,ordenarClientesResultado,generarArticulos,generarFiscal3000,exportCsv,imprimir};
})();