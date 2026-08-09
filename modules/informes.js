window.NOC=window.NOC||{};
NOC.Informes=(()=>{
  let currentRows=[];
  let currentCriteria=null;
  let currentReport="comercial";

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
      <div class="grid">
        <div class="card col-12">
          <div class="report-tabs">
            <button class="btn ${currentReport==="comercial"?"btn-primary":""}" onclick="NOC.Informes.cambiarInforme('comercial')">Por comercial</button>
            <button class="btn ${currentReport==="ventas"?"btn-primary":""}" onclick="NOC.Informes.cambiarInforme('ventas')">Ventas</button>
          </div>
          <div id="reportFilters"></div>
        </div>
        <div id="reportResult" class="card col-12" style="display:none"></div>
      </div>`;

    if(currentReport==="ventas")drawVentasFilters();
    else drawCommercialFilters(comerciales);
  }

  async function cambiarInforme(tipo){
    currentReport=tipo;
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
        .select("id,numero,fecha,base_imponible,iva,recargo,total,proforma_id,clientes(nombre,apellidos,nombre_tienda,localidad_facturacion),proformas(numero)")
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

  function clienteNombre(c){
    const personal=[c?.nombre,c?.apellidos].filter(Boolean).join(" ").trim();
    return personal||c?.nombre_tienda||"";
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
          <td>${NOC.App.esc(clienteNombre(r.clientes))}</td>
          <td>${NOC.App.esc(r.clientes?.localidad_facturacion||"")}</td>
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
    const t=totals(currentRows);

    if(currentCriteria.report==="ventas"){
      const headers=["Fecha","Num Factura","Cliente","Localidad","Base","IVA","RE","Total","Num Prof","Tienda"];
      const lines=[headers.map(csvCell).join(";")];
      currentRows.forEach(r=>lines.push([
        dateEs(r.fecha),r.numero,clienteNombre(r.clientes),r.clientes?.localidad_facturacion||"",
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

    if(c.report==="ventas"){
      const bodyRows=currentRows.map(r=>`<tr>
        <td>${dateEs(r.fecha)}</td><td>${NOC.App.esc(r.numero)}</td><td>${NOC.App.esc(clienteNombre(r.clientes))}</td>
        <td>${NOC.App.esc(r.clientes?.localidad_facturacion||"")}</td>
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

  return{render,cambiarInforme,generarComercial,generarVentas,exportCsv,imprimir};
})();