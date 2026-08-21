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

  const REPORT_STATE_KEY="noc_informes_state_v432";

  function capturarFiltrosInforme(){
    const out={};
    document.querySelectorAll("#reportFilters input,#reportFilters select,#reportFilters textarea").forEach(el=>{
      if(!el.id)return;
      out[el.id]=el.type==="checkbox"?Boolean(el.checked):el.value;
    });
    return out;
  }

  function aplicarFiltrosInforme(filters){
    Object.entries(filters||{}).forEach(([id,v])=>{
      const el=document.getElementById(id);
      if(!el)return;
      if(el.type==="checkbox")el.checked=Boolean(v);
      else el.value=v??"";
    });
  }

  function guardarEstadoInforme(){
    if(!currentCriteria||!Array.isArray(currentRows))return;
    try{
      sessionStorage.setItem(REPORT_STATE_KEY,JSON.stringify({
        report:currentReport,
        rows:currentRows,
        criteria:currentCriteria,
        filters:capturarFiltrosInforme(),
        scrollY:window.scrollY||0,
        savedAt:Date.now()
      }));
    }catch(e){console.warn("No se pudo guardar el estado del informe",e)}
  }

  function borrarEstadoInforme(){
    try{sessionStorage.removeItem(REPORT_STATE_KEY)}catch(_){}
  }

  function dibujarResultadoGuardado(){
    const r=currentCriteria?.report;
    if(r==="comercial")return drawCommercialResult();
    if(r==="ventas")return drawVentasResult();
    if(r==="proformas")return drawProformasResult();
    if(r==="clientes")return drawClientesResult();
    if(r==="clientes_inactivos")return drawClientesInactivosResult();
    if(r==="articulos")return drawArticulosResult();
    if(r==="fiscal3000")return drawFiscal3000Result();
  }

  function restaurarEstadoInforme(){
    try{
      const raw=sessionStorage.getItem(REPORT_STATE_KEY);
      if(!raw)return false;
      const s=JSON.parse(raw);
      if(!s||s.report!==currentReport||!s.criteria||!Array.isArray(s.rows))return false;
      currentRows=s.rows;
      currentCriteria=s.criteria;
      aplicarFiltrosInforme(s.filters);
      dibujarResultadoGuardado();
      requestAnimationFrame(()=>window.scrollTo({top:Number(s.scrollY||0),behavior:"auto"}));
      return true;
    }catch(e){
      console.warn("No se pudo restaurar el informe",e);
      return false;
    }
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

    if(currentReport!=="dashboard")restaurarEstadoInforme();
  }

  async function cambiarInforme(tipo){
    currentReport=tipo;
    localStorage.setItem("noc_current_report",tipo);
    currentRows=[];
    currentCriteria=null;
    borrarEstadoInforme();
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
        <div class="field f3">
          <label style="display:flex;align-items:center;gap:8px;margin-top:24px">
            <input id="repIgnorarCierre" type="checkbox">
            Ignorar fecha de cierre
          </label>
        </div>
        <div class="f12 toolbar" style="margin:4px 0 0">
          <button type="button" class="btn" onclick="NOC.Informes.abrirCierresComerciales()">Control de registros comerciales</button>
          <button class="btn btn-primary" type="submit">Generar informe</button>
        </div>
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
      rows=rows.filter(r=>!r.fechaProforma || r.fechaProforma<limite);
      rows=[...rows].sort((a,b)=>{
        if(!a.fechaProforma&&!b.fechaProforma)return String(a.tienda).localeCompare(String(b.tienda),"es");
        if(!a.fechaProforma)return -1;
        if(!b.fechaProforma)return 1;
        return String(a.fechaProforma).localeCompare(String(b.fechaProforma));
      });
      currentRows=rows;
      currentCriteria={report:"clientes_inactivos",meses,limite,orden:"fechaProforma",dir:"asc"};
      NOC.App.hideProgress();
      drawClientesInactivosResult();
    }catch(e){
      NOC.App.hideProgress();
      NOC.App.alertMessage("Error al generar informe",String(e?.message||e||"Error desconocido"),"error");
    }
  }

  function ordenarClientesInactivos(key){
    if(!currentCriteria||currentCriteria.report!=="clientes_inactivos")return;
    if(currentCriteria.orden===key)currentCriteria.dir=currentCriteria.dir==="asc"?"desc":"asc";
    else{currentCriteria.orden=key;currentCriteria.dir="asc"}

    currentRows=[...currentRows].sort((a,b)=>{
      let av=clienteValue(a,key),bv=clienteValue(b,key);
      if(key==="fechaProforma"){
        av=av||"";bv=bv||"";
      }
      const cmp=String(av??"").localeCompare(String(bv??""),"es",{numeric:true,sensitivity:"base"});
      return currentCriteria.dir==="desc"?-cmp:cmp;
    });
    drawClientesInactivosResult();
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
          <div class="muted">Sin pedido/proforma desde ${dateEs(c.limite)} · ${currentRows.length} cliente(s)</div>
        </div>
        <div class="toolbar-right">
          <button class="btn" onclick="NOC.Informes.exportCsv()">Exportar CSV</button>
          <button class="btn btn-primary" onclick="NOC.Informes.imprimir()">Imprimir / Guardar PDF</button>
        </div>
      </div>
      <div class="table-wrap report-table-wrap"><table class="report-table">
        <thead><tr>${cols.map(k=>{const a=c.orden===k;return `<th class="sortable-th ${a?"sort-active":""}" onclick="NOC.Informes.ordenarClientesInactivos('${k}')">${NOC.App.esc(clienteColumnDefs[k]?.label||k)} <span class="sort-mark">${a?(c.dir==="asc"?"↑":"↓"):"↕"}</span></th>`}).join("")}</tr></thead>
        <tbody>${currentRows.map(r=>`<tr>
          <td>${NOC.App.esc(r.tienda)}</td>
          <td>${NOC.App.esc(r.ultimaProforma)}</td>
          <td>${dateEs(r.fechaProforma)}</td>
          <td>${NOC.App.esc(r.ultimaFactura)}</td>
        </tr>`).join("")||`<tr><td colspan="4" class="empty">No hay clientes inactivos para ese periodo.</td></tr>`}</tbody>
      </table></div>`;
    guardarEstadoInforme();
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
    guardarEstadoInforme();
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
    guardarEstadoInforme();
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
      currentCriteria={report:"fiscal3000",year,minimo,orden:"base",dir:"desc"};
      NOC.App.hideProgress();
      drawFiscal3000Result();
    }catch(e){
      NOC.App.hideProgress();
      NOC.App.alertMessage("Error al generar informe","No se ha podido generar el informe. "+(e.message||e),"error");
    }
  }

  function fiscal3000Value(r,key){
    return {
      tienda:r.tienda||"",cliente:r.cliente||"",cif:r.cif||"",localidad:r.localidad||"",provincia:r.provincia||"",
      facturas:Number(r.facturas||0),base:Number(r.base||0),iva:Number(r.iva||0),re:Number(r.re||0),total:Number(r.total||0)
    }[key];
  }

  function ordenarFiscal3000Resultado(key){
    if(!currentCriteria||currentCriteria.report!=="fiscal3000")return;
    if(currentCriteria.orden===key)currentCriteria.dir=currentCriteria.dir==="asc"?"desc":"asc";
    else{currentCriteria.orden=key;currentCriteria.dir="asc"}
    const numeric=["facturas","base","iva","re","total"].includes(key);
    currentRows=[...currentRows].sort((a,b)=>{
      const av=fiscal3000Value(a,key),bv=fiscal3000Value(b,key);
      const cmp=numeric?Number(av)-Number(bv):String(av??"").localeCompare(String(bv??""),"es",{numeric:true,sensitivity:"base"});
      return currentCriteria.dir==="desc"?-cmp:cmp;
    });
    drawFiscal3000Result();
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
        <thead><tr>${[
          ["tienda","Tienda",""],["cliente","Cliente",""],["cif","CIF/NIF",""],["localidad","Localidad",""],["provincia","Provincia",""],
          ["facturas","Nº facturas","num"],["base","Base","num"],["iva","IVA","num"],["re","RE","num"],["total","Total","num"]
        ].map(([k,label,cls])=>{const a=c.orden===k;return `<th class="sortable-th ${a?"sort-active":""} ${cls}" onclick="NOC.Informes.ordenarFiscal3000Resultado('${k}')">${label} <span class="sort-mark">${a?(c.dir==="asc"?"↑":"↓"):"↕"}</span></th>`}).join("")}</tr></thead>
        <tbody>${currentRows.map(r=>`<tr><td><strong>${NOC.App.esc(r.tienda)}</strong></td><td>${NOC.App.esc(r.cliente)}</td><td>${NOC.App.esc(r.cif)}</td><td>${NOC.App.esc(r.localidad)}</td><td>${NOC.App.esc(r.provincia)}</td><td class="num">${r.facturas}</td><td class="num">${NOC.App.money(r.base)}</td><td class="num">${NOC.App.money(r.iva)}</td><td class="num">${NOC.App.money(r.re)}</td><td class="num"><strong>${NOC.App.money(r.total)}</strong></td></tr>`).join("")||`<tr><td colspan="10" class="empty">No hay puntos de venta que superen la base indicada.</td></tr>`}</tbody>
        ${currentRows.length?`<tfoot><tr class="report-total-row"><td colspan="6"><strong>TOTALES</strong></td><td class="num"><strong>${NOC.App.money(totals.base)}</strong></td><td class="num"><strong>${NOC.App.money(totals.iva)}</strong></td><td class="num"><strong>${NOC.App.money(totals.re)}</strong></td><td class="num"><strong>${NOC.App.money(totals.total)}</strong></td></tr></tfoot>`:""}
      </table></div>
      <div class="report-count muted">${currentRows.length} punto(s) de venta</div>`;
    guardarEstadoInforme();
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
      <p class="muted">Todos los filtros son opcionales. Si no seleccionas ninguno, se mostrarán todos los artículos pedidos en proformas no canceladas.</p>
      <form id="reportArticlesForm" class="form-grid" onsubmit="event.preventDefault();NOC.Informes.generarArticulos()">
        <div class="field f3"><label>Fecha inicio</label><input id="artDesde" type="date"></div>
        <div class="field f3"><label>Fecha fin</label><input id="artHasta" type="date"></div>
        <div class="field f3"><label>Fábrica</label><select id="artFabrica"><option value="">Todas</option>${fabricas.map(v=>`<option value="${NOC.App.esc(v)}">${NOC.App.esc(v)}</option>`).join("")}</select></div>
        <div class="field f3"><label>Tipo</label><select id="artTipo"><option value="">Todos</option>${tipos.map(v=>`<option value="${NOC.App.esc(v)}">${NOC.App.esc(v)}</option>`).join("")}</select></div>
        <div class="field f6"><label>Artículo</label><select id="artArticulo"><option value="">Todos</option>${articuloCatalogo.map(a=>`<option value="${a.id}">${NOC.App.esc(a.nombre_producto)}${a.sku?` · ${NOC.App.esc(a.sku)}`:""}</option>`).join("")}</select></div>
        <div class="f6 toolbar" style="align-items:end"><div></div><button class="btn btn-primary" type="submit">Generar informe</button></div>
      </form>`;
  }

  function normalizarNombreArticulo(v){
    return String(v||"")
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/\s+/g," ")
      .trim()
      .toLocaleLowerCase("es");
  }

  async function generarArticulos(){
    const desde=document.getElementById("artDesde").value;
    const hasta=document.getElementById("artHasta").value;
    const fabrica=document.getElementById("artFabrica").value.trim();
    const tipo=document.getElementById("artTipo").value.trim();
    const articuloId=document.getElementById("artArticulo").value;

    if(desde&&hasta&&desde>hasta)return NOC.App.alertMessage("Periodo incorrecto","La fecha de inicio no puede ser posterior a la fecha fin.","error");

    NOC.App.showProgress("Generando informe de artículos…","Analizando pedidos de proformas");
    try{
      // 1) Catálogo completo para poder recuperar líneas antiguas importadas
      //    que no tienen articulo_id pero sí conservan la descripción.
      const {data:catalogo,error:catalogoError}=await NOC.API.db()
        .from("articulos")
        .select("id,nombre_producto,sku,fabrica,tipo_articulo,tipo_prenda");
      if(catalogoError)throw catalogoError;

      const catalogoPorId=new Map((catalogo||[]).map(a=>[String(a.id),a]));
      const catalogoPorNombre=new Map();
      (catalogo||[]).forEach(a=>{
        const key=normalizarNombreArticulo(a.nombre_producto);
        if(!key)return;
        // Solo usamos coincidencia automática cuando el nombre identifica
        // inequívocamente un único artículo.
        if(!catalogoPorNombre.has(key))catalogoPorNombre.set(key,a);
        else catalogoPorNombre.set(key,null);
      });

      // 2) El informe comercial de artículos se basa en PROFORMAS:
      //    representan el pedido real. Las canceladas no cuentan.
      let q=NOC.API.db().from("lineas_proforma")
        .select("id,proforma_id,articulo_id,descripcion,cantidad,precio_unitario,descuento,es_envio,proformas!inner(fecha,numero,estado)")
        .eq("es_envio",false)
        .neq("proformas.estado","Cancelada");

      if(desde)q=q.gte("proformas.fecha",desde);
      if(hasta)q=q.lte("proformas.fecha",hasta);

      const {data,error}=await q;
      if(error)throw error;

      let rows=(data||[]).map(r=>{
        let a=null;
        if(r.articulo_id)a=catalogoPorId.get(String(r.articulo_id))||null;

        // Histórico importado: si no había articulo_id, intentamos enlazar
        // por nombre exacto normalizado. Si el nombre es ambiguo, no inventamos.
        if(!a&&!r.articulo_id){
          const key=normalizarNombreArticulo(r.descripcion);
          const candidato=catalogoPorNombre.get(key);
          if(candidato)a=candidato;
        }
        return {...r,_articulo:a};
      });

      // Filtros por artículo/fábrica/tipo usando el catálogo recuperado.
      if(articuloId)rows=rows.filter(r=>String(r._articulo?.id||"")===String(articuloId));
      if(fabrica)rows=rows.filter(r=>String(r._articulo?.fabrica||"")===fabrica);
      if(tipo)rows=rows.filter(r=>String(r._articulo?.tipo_prenda||r._articulo?.tipo_articulo||"")===tipo);

      const map=new Map();
      rows.forEach(r=>{
        const a=r._articulo||{};
        // Si se pudo identificar catálogo, agrupamos por id.
        // Si no, mantenemos la descripción histórica como grupo independiente.
        const key=a.id?`id:${a.id}`:`desc:${normalizarNombreArticulo(r.descripcion)}`;
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
        // Se mantiene el nombre histórico "facturación líneas" del informe,
        // pero el importe representa ahora el valor de las líneas pedidas.
        x.facturado+=precio*cantidad*(1-descuento/100);
      });

      currentRows=[...map.values()].sort((a,b)=>b.unidades-a.unidades||b.facturado-a.facturado);
      currentCriteria={report:"articulos",desde,hasta,fabrica,tipo,articuloId,origen:"proformas",orden:"unidades",dir:"desc"};
      NOC.App.hideProgress();
      drawArticulosResult();
    }catch(e){
      NOC.App.hideProgress();
      NOC.App.alertMessage("Error al generar informe","No se ha podido obtener el informe de artículos. "+(e.message||e),"error");
    }
  }

  function articuloValue(r,key){
    return {
      articulo:r.articulo||"",
      sku:r.sku||"",
      tipo:r.tipo||"",
      fabrica:r.fabrica||"",
      unidades:Number(r.unidades||0),
      facturado:Number(r.facturado||0)
    }[key];
  }

  function ordenarArticulosResultado(key){
    if(!currentCriteria||currentCriteria.report!=="articulos")return;
    if(currentCriteria.orden===key)currentCriteria.dir=currentCriteria.dir==="asc"?"desc":"asc";
    else{currentCriteria.orden=key;currentCriteria.dir="asc"}
    const numeric=["unidades","facturado"].includes(key);
    currentRows=[...currentRows].sort((a,b)=>{
      const av=articuloValue(a,key),bv=articuloValue(b,key);
      const cmp=numeric?Number(av)-Number(bv):String(av??"").localeCompare(String(bv??""),"es",{numeric:true,sensitivity:"base"});
      return currentCriteria.dir==="desc"?-cmp:cmp;
    });
    drawArticulosResult();
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
        <div class="dash-metric-card"><div class="dash-metric-label">Importe líneas</div><div class="dash-metric-value">${NOC.App.money(totalFacturado)}</div></div>
        <div class="dash-metric-card"><div class="dash-metric-label">Artículos distintos</div><div class="dash-metric-value">${currentRows.length}</div></div>
      </div>
      <div class="table-wrap">
        <table class="report-table">
          <thead><tr>${[
            ["articulo","Artículo",""],["sku","SKU",""],["tipo","Tipo",""],["fabrica","Fábrica",""],
            ["unidades","Unidades pedidas","num"],["facturado","Importe líneas","num"]
          ].map(([k,label,cls])=>{const a=c.orden===k;return `<th class="sortable-th ${a?"sort-active":""} ${cls}" onclick="NOC.Informes.ordenarArticulosResultado('${k}')">${label} <span class="sort-mark">${a?(c.dir==="asc"?"↑":"↓"):"↕"}</span></th>`}).join("")}</tr></thead>
          <tbody>${currentRows.map((r,i)=>`<tr>
            <td><strong>${NOC.App.esc(r.articulo)}</strong>${i<3&&r.unidades>0?` <span class="rank-badge">#${i+1}</span>`:""}</td>
            <td>${NOC.App.esc(r.sku)}</td><td>${NOC.App.esc(r.tipo)}</td><td>${NOC.App.esc(r.fabrica)}</td>
            <td class="num"><strong>${Number(r.unidades).toLocaleString("es-ES")}</strong></td>
            <td class="num">${NOC.App.money(r.facturado)}</td>
          </tr>`).join("")||`<tr><td colspan="6" class="empty">No hay pedidos que coincidan con los filtros seleccionados.</td></tr>`}</tbody>
          ${currentRows.length?`<tfoot><tr class="report-total-row"><td colspan="4"><strong>TOTALES</strong></td><td class="num"><strong>${totalUnidades.toLocaleString("es-ES")}</strong></td><td class="num"><strong>${NOC.App.money(totalFacturado)}</strong></td></tr></tfoot>`:""}
        </table>
      </div>`;
    guardarEstadoInforme();
    box.scrollIntoView({behavior:"smooth",block:"start"});
  }


  function asegurarEstiloCierres(){
    if(document.getElementById("nocCierresResponsiveStyle"))return;
    const style=document.createElement("style");
    style.id="nocCierresResponsiveStyle";
    style.textContent=`
      .cierres-modal-body{padding:18px 20px!important;overflow-x:hidden!important}
      .cierres-help{margin:0 0 16px;line-height:1.45}
      .cierres-list{display:grid;gap:10px}
      .cierre-card{
        display:grid;
        grid-template-columns:minmax(140px,1.1fr) minmax(150px,.75fr) minmax(200px,1.4fr) auto;
        gap:12px;
        align-items:end;
        padding:12px 14px;
        border:1px solid #e5e7e9;
        border-radius:12px;
        background:#fff;
      }
      .cierre-card .field{min-width:0}
      .cierre-card .field label{display:block;margin-bottom:6px}
      .cierre-comercial{
        min-height:42px;
        display:flex;
        align-items:center;
        padding:9px 11px;
        border:1px solid #e1e3e5;
        border-radius:9px;
        background:#f7f8f8;
        font-weight:700;
        overflow-wrap:anywhere;
      }
      .cierre-card input{width:100%;min-width:0}
      .cierre-save{min-height:42px;white-space:nowrap}
      @media(max-width:700px){
        .modal.cierres-comerciales-modal{
          width:min(94vw,520px)!important;
          max-width:94vw!important;
          max-height:88vh!important;
          margin:auto!important;
        }
        .cierres-modal-body{padding:14px!important}
        .cierres-help{font-size:13px;margin-bottom:12px}
        .cierre-card{
          grid-template-columns:1fr;
          gap:9px;
          padding:14px;
          border-radius:14px;
        }
        .cierre-card .field label{font-size:11px}
        .cierre-save{width:100%}
      }
    `;
    document.head.appendChild(style);
  }

  async function cargarCierreComercial(comercial){
    if(!comercial)return null;
    const {data,error}=await NOC.API.db()
      .from("cierres_comerciales")
      .select("id,comercial,fecha_fin_registro,observaciones,created_at,updated_at")
      .eq("comercial",comercial)
      .maybeSingle();
    if(error)throw error;
    return data||null;
  }

  async function abrirCierresComerciales(){
    let comerciales=[];
    try{
      const clientes=await NOC.API.list("clientes",{select:"comercial"});
      comerciales=[...new Set((clientes||[]).map(c=>String(c.comercial||"").trim()).filter(Boolean))]
        .sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"}));
    }catch(e){}

    let cierres=[];
    try{
      const {data,error}=await NOC.API.db().from("cierres_comerciales")
        .select("id,comercial,fecha_fin_registro,observaciones")
        .order("comercial",{ascending:true});
      if(error)throw error;
      cierres=data||[];
    }catch(e){
      return NOC.App.alertMessage("No se pudo abrir el control de cierres",String(e?.message||e||"Error desconocido"),"error");
    }

    const map=new Map(cierres.map(c=>[String(c.comercial),c]));
    asegurarEstiloCierres();
    NOC.App.modal(`
      <div class="modal-head">
        <strong>Control de registros comerciales</strong>
        <button class="icon-btn" onclick="NOC.App.closeModal()">×</button>
      </div>
      <div class="modal-body cierres-modal-body">
        <p class="muted cierres-help">Indica hasta qué fecha consideras ya registrado cada comercial. El día de cierre queda incluido; el siguiente informe normal empezará al día siguiente.</p>
        <div class="cierres-list">
          ${comerciales.map(c=>{
            const x=map.get(c)||{};
            const key=btoa(unescape(encodeURIComponent(c))).replace(/=/g,"");
            return `<div class="cierre-card">
              <div class="field"><label>Comercial</label><div class="cierre-comercial">${NOC.App.esc(c)}</div></div>
              <div class="field"><label>Registrado hasta</label><input id="cierreFecha_${key}" type="date" value="${x.fecha_fin_registro||""}"></div>
              <div class="field"><label>Observaciones</label><input id="cierreObs_${key}" value="${NOC.App.esc(x.observaciones||"")}" placeholder="Opcional"></div>
              <button class="btn btn-primary cierre-save" onclick="NOC.Informes.guardarCierreComercial('${encodeURIComponent(c)}')">Guardar</button>
            </div>`;
          }).join("")||`<div class="empty">No hay comerciales definidos en clientes.</div>`}
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="NOC.App.closeModal()">Cerrar</button>
      </div>`,true,"cierres-comerciales-modal");
  }

  async function guardarCierreComercial(comercialEncoded){
    const comercial=decodeURIComponent(comercialEncoded);
    const key=btoa(unescape(encodeURIComponent(comercial))).replace(/=/g,"");
    const fecha=document.getElementById(`cierreFecha_${key}`)?.value||"";
    const observaciones=document.getElementById(`cierreObs_${key}`)?.value||"";
    try{
      const db=NOC.API.db();
      if(!fecha){
        const {error}=await db.from("cierres_comerciales").delete().eq("comercial",comercial);
        if(error)throw error;
        return NOC.App.toast(`Cierre eliminado para ${comercial}.`);
      }
      const {error}=await db.from("cierres_comerciales").upsert({
        comercial,
        fecha_fin_registro:fecha,
        observaciones:observaciones||null,
        updated_at:new Date().toISOString()
      },{onConflict:"comercial"});
      if(error)throw error;
      NOC.App.toast(`Cierre guardado para ${comercial}.`);
    }catch(e){
      NOC.App.alertMessage("No se pudo guardar",String(e?.message||e||"Error desconocido"),"error");
    }
  }

  function diaSiguienteISO(fecha){
    if(!fecha)return "";
    const d=new Date(fecha+"T12:00:00");
    d.setDate(d.getDate()+1);
    return d.toISOString().slice(0,10);
  }

  async function generarComercial(){
    const comercial=document.getElementById("repComercial").value.trim();
    const tipo=document.getElementById("repTipo").value;
    const desde=document.getElementById("repDesde").value;
    const hasta=document.getElementById("repHasta").value;
    const ignorarCierre=Boolean(document.getElementById("repIgnorarCierre")?.checked);
    if(!comercial||!desde||!hasta)return NOC.App.alertMessage("Faltan datos","Selecciona comercial y ambas fechas.","error");
    if(desde>hasta)return NOC.App.alertMessage("Periodo incorrecto","La fecha de inicio no puede ser posterior a la fecha fin.","error");

    NOC.App.modal(`
      <div class="modal-head">
        <strong>Gastos de envío</strong>
        <button class="icon-btn" onclick="NOC.App.closeModal()">×</button>
      </div>
      <div class="modal-body">
        <p>¿Quieres que el informe por comercial tenga en cuenta los gastos de envío dentro de la Base?</p>
        <p class="muted">El aspecto del informe será el mismo. Solo cambia el cálculo de la Base y su total.</p>
      </div>
      <div class="modal-foot" style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn" onclick="NOC.Informes.generarComercialConEnvio(false,${ignorarCierre})">Sin gastos de envío</button>
        <button class="btn btn-primary" onclick="NOC.Informes.generarComercialConEnvio(true,${ignorarCierre})">Con gastos de envío</button>
      </div>`,true);
  }

  async function generarComercialConEnvio(incluirEnvio,ignorarCierre=false){
    const comercial=document.getElementById("repComercial").value.trim();
    const tipo=document.getElementById("repTipo").value;
    const desdeSolicitado=document.getElementById("repDesde").value;
    const hasta=document.getElementById("repHasta").value;
    NOC.App.closeModal();

    let cierre=null;
    let desdeEfectivo=desdeSolicitado;
    if(!ignorarCierre){
      cierre=await cargarCierreComercial(comercial);
      if(cierre?.fecha_fin_registro){
        const siguiente=diaSiguienteISO(cierre.fecha_fin_registro);
        if(siguiente>desdeEfectivo)desdeEfectivo=siguiente;
      }
    }

    const tabla=tipo==="facturado"?"facturas":"proformas";
    const etiqueta=tipo==="facturado"?"Facturado":"Proformado";
    NOC.App.showProgress("Generando informe…",`${etiqueta} · ${comercial}`);
    try{
      let q=NOC.API.db().from(tabla)
        .select(tipo==="facturado"
          ?"id,numero,fecha,base_imponible,iva,recargo,total,envio_precio,envio_descuento,clientes!inner(nombre_tienda,comercial)"
          :"id,numero,fecha,estado,base_imponible,iva,recargo,total,envio_precio,envio_descuento,clientes!inner(nombre_tienda,comercial)")
        .eq("clientes.comercial",comercial).gte("fecha",desdeEfectivo).lte("fecha",hasta);

      if(tipo==="proformado")q=q.neq("estado","Cancelada");
      q=q.order("fecha",{ascending:true}).order("numero",{ascending:true});

      const {data,error}=await q;
      if(error)throw error;

      currentRows=(data||[]).map(r=>{
        const envioNeto=Number(r.envio_precio||0)*(1-Number(r.envio_descuento||0)/100);
        const baseOriginal=Number(r.base_imponible||0);
        return {
          ...r,
          base_imponible_original:baseOriginal,
          base_imponible:incluirEnvio?baseOriginal:Math.round((baseOriginal-envioNeto+Number.EPSILON)*100)/100
        };
      });

      currentCriteria={
        report:"comercial",
        comercial,tipo,etiqueta,desde:desdeSolicitado,hasta,
        desdeEfectivo,
        cierreFecha:cierre?.fecha_fin_registro||"",
        ignorarCierre:Boolean(ignorarCierre),
        orden:"fecha",dir:"asc",
        incluirEnvio:Boolean(incluirEnvio)
      };
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
      currentCriteria={report:"ventas",tipo,tipoEtiqueta:etiquetas[tipo],desde,hasta,orden:"fecha",dir:"asc"};
      NOC.App.hideProgress();
      drawVentasResult();
    }catch(e){
      NOC.App.hideProgress();
      NOC.App.alertMessage("Error al generar informe","No se ha podido obtener el informe de ventas. "+(e.message||e),"error");
    }
  }

  function comercialValue(r,key){
    return {
      fecha:r.fecha||"",
      numero:r.numero||"",
      tienda:r.clientes?.nombre_tienda||"",
      base:Number(r.base_imponible||0),
      iva:Number(r.iva||0),
      re:Number(r.recargo||0),
      total:Number(r.total||0)
    }[key];
  }

  function ordenarComercialResultado(key){
    if(!currentCriteria||currentCriteria.report!=="comercial")return;
    if(currentCriteria.orden===key)currentCriteria.dir=currentCriteria.dir==="asc"?"desc":"asc";
    else{currentCriteria.orden=key;currentCriteria.dir="asc"}

    const numeric=["base","iva","re","total"].includes(key);
    currentRows=[...currentRows].sort((a,b)=>{
      const av=comercialValue(a,key),bv=comercialValue(b,key);
      let cmp;
      if(numeric)cmp=Number(av||0)-Number(bv||0);
      else cmp=String(av??"").localeCompare(String(bv??""),"es",{numeric:true,sensitivity:"base"});
      return currentCriteria.dir==="desc"?-cmp:cmp;
    });
    drawCommercialResult();
  }

  function drawCommercialResult(){
    const box=document.getElementById("reportResult");
    const t=totals(currentRows),c=currentCriteria;
    box.style.display="";
    box.innerHTML=`
      <div class="report-head">
        <div><h2 style="margin-bottom:5px">Informe por comercial</h2><div class="muted"><strong>${NOC.App.esc(c.comercial)}</strong> · ${c.etiqueta} · ${dateEs(c.desde)} a ${dateEs(c.hasta)} · ${c.incluirEnvio===false?"Sin gastos de envío":"Con gastos de envío"}${c.ignorarCierre?" · Ignorando cierre":(c.cierreFecha?` · Registrado hasta ${dateEs(c.cierreFecha)} · Periodo efectivo desde ${dateEs(c.desdeEfectivo)}`:"")}</div></div>
        <div class="toolbar-right"><button class="btn" onclick="NOC.Informes.exportCsv()">Exportar CSV</button><button class="btn btn-primary" onclick="NOC.Informes.imprimir()">Imprimir / Guardar PDF</button></div>
      </div>
      <div class="table-wrap report-table-wrap"><table class="report-table">
        <thead><tr>
          ${[
            ["fecha","Fecha",""],
            ["numero",`Nº ${c.tipo==="facturado"?"factura":"proforma"}`,""],
            ["tienda","Tienda",""],
            ["base","Base","num"],
            ["iva","IVA","num"],
            ["re","RE","num"],
            ["total","Total","num"]
          ].map(([k,label,cls])=>{
            const active=c.orden===k;
            return `<th class="sortable-th ${active?"sort-active":""} ${cls}" onclick="NOC.Informes.ordenarComercialResultado('${k}')" title="Ordenar por ${NOC.App.esc(label)}">${NOC.App.esc(label)} <span class="sort-mark">${active?(c.dir==="asc"?"↑":"↓"):"↕"}</span></th>`;
          }).join("")}
        </tr></thead>
        <tbody>${currentRows.map(r=>`<tr><td>${dateEs(r.fecha)}</td><td><strong>${NOC.App.esc(r.numero)}</strong></td><td>${NOC.App.esc(r.clientes?.nombre_tienda||"")}</td><td class="num">${NOC.App.money(r.base_imponible)}</td><td class="num">${NOC.App.money(r.iva)}</td><td class="num">${NOC.App.money(r.recargo)}</td><td class="num"><strong>${NOC.App.money(r.total)}</strong></td></tr>`).join("") || `<tr><td colspan="7" class="empty">No hay documentos para este comercial en el periodo seleccionado.</td></tr>`}</tbody>
        ${currentRows.length?`<tfoot><tr class="report-total-row"><td colspan="3"><strong>TOTALES</strong></td><td class="num"><strong>${NOC.App.money(t.base)}</strong></td><td class="num"><strong>${NOC.App.money(t.iva)}</strong></td><td class="num"><strong>${NOC.App.money(t.re)}</strong></td><td class="num"><strong>${NOC.App.money(t.total)}</strong></td></tr></tfoot>`:""}
      </table></div><div class="report-count muted">${currentRows.length} documento(s)</div>`;
    guardarEstadoInforme();
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

  function ventaValue(r,key){
    return {
      fecha:r.fecha||"",
      numero:r.numero||"",
      cliente:clienteNombre(r.clientes,r),
      localidad:clienteLocalidad(r.clientes,r),
      base:Number(r.base_imponible||0),
      iva:Number(r.iva||0),
      re:Number(r.recargo||0),
      total:Number(r.total||0),
      proforma:r.proformas?.numero||"",
      tienda:r.clientes?.nombre_tienda||""
    }[key];
  }

  function ordenarVentasResultado(key){
    if(!currentCriteria||currentCriteria.report!=="ventas")return;
    if(currentCriteria.orden===key)currentCriteria.dir=currentCriteria.dir==="asc"?"desc":"asc";
    else{currentCriteria.orden=key;currentCriteria.dir="asc"}
    const numeric=["base","iva","re","total"].includes(key);
    currentRows=[...currentRows].sort((a,b)=>{
      const av=ventaValue(a,key),bv=ventaValue(b,key);
      const cmp=numeric?Number(av)-Number(bv):String(av??"").localeCompare(String(bv??""),"es",{numeric:true,sensitivity:"base"});
      return currentCriteria.dir==="desc"?-cmp:cmp;
    });
    drawVentasResult();
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
        <thead><tr>${[
          ["fecha","Fecha",""],["numero","Num Factura",""],["cliente","Cliente",""],["localidad","Localidad",""],
          ["base","Base","num"],["iva","IVA","num"],["re","RE","num"],["total","Total","num"],
          ["proforma","Num Prof",""],["tienda","Tienda",""]
        ].map(([k,label,cls])=>{const a=c.orden===k;return `<th class="sortable-th ${a?"sort-active":""} ${cls}" onclick="NOC.Informes.ordenarVentasResultado('${k}')">${label} <span class="sort-mark">${a?(c.dir==="asc"?"↑":"↓"):"↕"}</span></th>`}).join("")}</tr></thead>
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
    guardarEstadoInforme();
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

  document.addEventListener("visibilitychange",()=>{if(document.hidden)guardarEstadoInforme()});
  window.addEventListener("pagehide",guardarEstadoInforme);

  return{render,cambiarInforme,abrirCierresComerciales,guardarCierreComercial,generarComercial,generarComercialConEnvio,ordenarComercialResultado,generarVentas,ordenarVentasResultado,generarProformas,limpiarProformas,ordenarProformasResultado,generarClientes,generarClientesInactivos,ordenarClientesResultado,ordenarClientesInactivos,generarArticulos,ordenarArticulosResultado,generarFiscal3000,ordenarFiscal3000Resultado,exportCsv,imprimir};
})();