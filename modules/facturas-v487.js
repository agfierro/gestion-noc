window.NOC=window.NOC||{};
NOC.Facturas=(()=>{
 let rows=[],query="",sort={key:"numero",dir:"desc"};
 let filters={desde:"",hasta:"",pagos:[],tipo:""};
 let selectedIds=new Set();
 let ventaClientes=[];
 let pdfRange={mode:"fecha",fechaDesde:"",fechaHasta:"",numeroDesde:"",numeroHasta:""};
 const dateEs=v=>{if(!v)return"";const [y,m,d]=String(v).split("-");return `${d}/${m}/${y}`};
 const value=(r,k)=>({numero:r.numero||"",fecha:r.fecha_expedicion||r.fecha||"",fecha_operacion:r.fecha_operacion||r.fecha||"",cliente:r.cliente_nombre_tienda||r.clientes?.nombre_tienda||"",
   base:Number(r.base_imponible||0),iva:Number(r.iva||0),recargo:Number(r.recargo||0),
   total:Number(r.total||0),pago:r.forma_pago||"",proforma:r.proformas?.numero||""})[k];
 function compare(a,b){const va=value(a,sort.key),vb=value(b,sort.key);let c=(typeof va==="number"||typeof vb==="number")?Number(va||0)-Number(vb||0):String(va??"").localeCompare(String(vb??""),"es",{numeric:true,sensitivity:"base"});return sort.dir==="asc"?c:-c}
 function shown(){
   const q=query.trim().toLocaleLowerCase("es");
   return rows.filter(r=>{
     const numero=String(r.numero||"").toLocaleLowerCase("es");
     const tienda=String(r.cliente_nombre_tienda||r.clientes?.nombre_tienda||"").toLocaleLowerCase("es");
     if(q && !numero.includes(q) && !tienda.includes(q))return false;
     if(filters.desde && String(r.fecha||"")<filters.desde)return false;
     if(filters.hasta && String(r.fecha||"")>filters.hasta)return false;
     if(filters.pagos.length && !filters.pagos.includes(String(r.forma_pago||"")))return false;
     if(filters.tipo){
       const tienda=String(r.cliente_nombre_tienda||r.clientes?.nombre_tienda||"").trim().toLocaleLowerCase("es");
       const esParticular=tienda==="particular";
       if(filters.tipo==="particular" && !esParticular)return false;
       if(filters.tipo==="mayorista" && esParticular)return false;
     }
     return true;
   }).sort(compare);
 }
 function head(k,t,cl=""){const a=sort.key===k;return `<th class="${cl} sortable-th ${a?"sort-active":""}" onclick="NOC.Facturas.setSort('${k}')">${t} <span class="sort-mark">${a?(sort.dir==="asc"?"↑":"↓"):"↕"}</span></th>`}
 function numeroOrden(a,b){return String(a.numero||"").localeCompare(String(b.numero||""),"es",{numeric:true,sensitivity:"base"})}
 function facturasPorNumero(){return [...rows].sort(numeroOrden)}
 function pdfRows(){
   if(pdfRange.mode==="fecha"){
     if(!pdfRange.fechaDesde&&!pdfRange.fechaHasta)return[];
     return [...rows].filter(r=>(!pdfRange.fechaDesde||String(r.fecha)>=pdfRange.fechaDesde)&&(!pdfRange.fechaHasta||String(r.fecha)<=pdfRange.fechaHasta)).sort((a,b)=>String(a.fecha||"").localeCompare(String(b.fecha||""))||numeroOrden(a,b));
   }
   if(!pdfRange.numeroDesde&&!pdfRange.numeroHasta)return[];
   const all=facturasPorNumero();
   let i1=pdfRange.numeroDesde?all.findIndex(r=>r.numero===pdfRange.numeroDesde):0;
   let i2=pdfRange.numeroHasta?all.findIndex(r=>r.numero===pdfRange.numeroHasta):all.length-1;
   if(i1<0||i2<0)return[];
   if(i1>i2)[i1,i2]=[i2,i1];
   return all.slice(i1,i2+1);
 }
 function pdfRangeLabel(){
   if(pdfRange.mode==="fecha")return [pdfRange.fechaDesde,pdfRange.fechaHasta].filter(Boolean).join(" a ")||"rango_fecha";
   return [pdfRange.numeroDesde,pdfRange.numeroHasta].filter(Boolean).join(" a ")||"rango_numeracion";
 }
 function filterPanel(){
   const pagos=[...new Set(["Transferencia","Tarjeta","Bizum","PayPal","Metálico",...rows.map(r=>String(r.forma_pago||"")).filter(Boolean)])];
   const esc=NOC.App.esc;
   return `<div class="modern-filter-card invoice-main-filters">
     <div class="modern-filter-field"><label>Desde</label><input id="invoiceFilterDesde" type="date" value="${esc(filters.desde)}" onchange="NOC.Facturas.setFilter('desde',this.value)"></div>
     <div class="modern-filter-field"><label>Hasta</label><input id="invoiceFilterHasta" type="date" value="${esc(filters.hasta)}" onchange="NOC.Facturas.setFilter('hasta',this.value)"></div>
     <div class="modern-filter-field"><label>Pago</label><details class="noc-multi-filter" style="position:relative;min-width:150px"><summary style="cursor:pointer;list-style:none;border:1px solid #d7dbe2;border-radius:8px;padding:9px 34px 9px 11px;background:#fff;white-space:nowrap;position:relative">${esc(!filters.pagos.length?"Todos":filters.pagos.length===1?filters.pagos[0]:`${filters.pagos.length} seleccionados`)}<span style="position:absolute;right:11px">⌄</span></summary><div style="position:absolute;z-index:30;top:calc(100% + 5px);left:0;min-width:190px;background:#fff;border:1px solid #d7dbe2;border-radius:10px;box-shadow:0 10px 28px rgba(0,0,0,.14);padding:8px">${pagos.map(x=>`<label style="display:flex;align-items:center;gap:8px;padding:7px 5px;cursor:pointer"><input type="checkbox" ${filters.pagos.includes(x)?"checked":""} onchange="NOC.Facturas.togglePagoFilter('${String(x).replace(/'/g,"\\'")}',this.checked)"><span>${esc(x)}</span></label>`).join("")}</div></details></div>
     <div class="modern-filter-field"><label>Tipo</label><select onchange="NOC.Facturas.setFilter('tipo',this.value)"><option value="" ${!filters.tipo?"selected":""}>Todos</option><option value="mayorista" ${filters.tipo==="mayorista"?"selected":""}>Mayorista</option><option value="particular" ${filters.tipo==="particular"?"selected":""}>Particulares</option></select></div>
     <button class="btn modern-clear-btn" onclick="NOC.Facturas.clearFilters()">Limpiar filtros</button>
   </div>`;
 }
 function setFilter(k,v){
   if(!Object.prototype.hasOwnProperty.call(filters,k))return;
   filters[k]=v||"";
   draw();
 }
 function togglePagoFilter(value,checked){
   const vals=new Set(filters.pagos||[]);
   checked?vals.add(value):vals.delete(value);
   filters.pagos=[...vals];
   draw();
 }
 function clearFilters(){
   filters={desde:"",hasta:"",pagos:[],tipo:""};
   query="";
   draw();
 }
 function pdfPanel(){
   const nums=facturasPorNumero();
   const count=selectedIds.size;
   const esc=NOC.App.esc;
   return `<div class="modern-filter-card invoice-pdf-card" style="margin-bottom:18px;align-items:end">
     <div class="modern-filter-field"><label>Generación masiva PDF</label><select id="invoicePdfMode" onchange="NOC.Facturas.pdfMode(this.value)"><option value="fecha" ${pdfRange.mode==="fecha"?"selected":""}>Por fecha</option><option value="numero" ${pdfRange.mode==="numero"?"selected":""}>Por numeración</option></select></div>
     <div class="modern-filter-field invoice-pdf-date" style="${pdfRange.mode==="fecha"?"":"display:none"}"><label>Desde</label><input type="date" value="${esc(pdfRange.fechaDesde)}" onchange="NOC.Facturas.pdfField('fechaDesde',this.value)"></div>
     <div class="modern-filter-field invoice-pdf-date" style="${pdfRange.mode==="fecha"?"":"display:none"}"><label>Hasta</label><input type="date" value="${esc(pdfRange.fechaHasta)}" onchange="NOC.Facturas.pdfField('fechaHasta',this.value)"></div>
     <div class="modern-filter-field invoice-pdf-num" style="${pdfRange.mode==="numero"?"":"display:none"}"><label>Desde</label><select onchange="NOC.Facturas.pdfField('numeroDesde',this.value)"><option value="">Seleccionar…</option>${nums.map(r=>`<option value="${esc(r.numero)}" ${pdfRange.numeroDesde===r.numero?"selected":""}>${esc(r.numero)}</option>`).join("")}</select></div>
     <div class="modern-filter-field invoice-pdf-num" style="${pdfRange.mode==="numero"?"":"display:none"}"><label>Hasta</label><select onchange="NOC.Facturas.pdfField('numeroHasta',this.value)"><option value="">Seleccionar…</option>${nums.map(r=>`<option value="${esc(r.numero)}" ${pdfRange.numeroHasta===r.numero?"selected":""}>${esc(r.numero)}</option>`).join("")}</select></div>
     <div style="min-width:150px"><small class="muted">Seleccionadas</small><div id="invoicePdfCount" style="font-size:22px;font-weight:850;line-height:1.2;margin-top:5px">${count}</div></div>
     <button id="invoicePdfBtn" class="btn btn-primary" ${count?"":"disabled"} onclick="NOC.Facturas.generarPdfZip()">Generar ZIP de PDF</button>
   </div>`;
 }
 async function render(){
   const {data,error}=await NOC.API.db().from("facturas").select("*, clientes(nombre_tienda), proformas(id,numero)").order("created_at",{ascending:false});
   if(error)throw error;
   rows=data||[];
   const valid=new Set(rows.map(r=>r.id));
   selectedIds=new Set([...selectedIds].filter(id=>valid.has(id)));
   draw();
 }
 function draw(){
   const rr=shown(),base=rr.reduce((s,r)=>s+Number(r.base_imponible||0),0),iva=rr.reduce((s,r)=>s+Number(r.iva||0),0),total=rr.reduce((s,r)=>s+Number(r.total||0),0);
   document.getElementById("viewContainer").innerHTML=`<div class="noc-modern-page noc-facturas-modern">
   <div class="modern-page-head"><div><div class="modern-kicker">GESTIÓN COMERCIAL</div><h1>Facturas</h1><p>Consulta, busca y ordena tus facturas.</p></div>
   <div class="modern-head-actions"><button class="btn btn-primary" onclick="NOC.Facturas.abrirVentaDirecta()">+ Venta directa</button><div class="modern-search"><span class="search-glyph">⌕</span><input id="invoiceSearch" placeholder="Buscar por Nº o tienda…" value="${NOC.App.esc(query)}" oninput="NOC.Facturas.search(this)"></div></div></div>
   ${filterPanel()}
   <div class="modern-kpis invoice-kpis">
    <div class="modern-kpi"><span class="kpi-icon">▤</span><div><small>Facturas</small><strong>${rr.length}</strong></div></div>
    <div class="modern-kpi"><span class="kpi-icon">€</span><div><small>Base</small><strong>${NOC.App.money(base)}</strong></div></div>
    <div class="modern-kpi kpi-blue"><span class="kpi-icon">%</span><div><small>IVA</small><strong>${NOC.App.money(iva)}</strong></div></div>
    <div class="modern-kpi kpi-green"><span class="kpi-icon">Σ</span><div><small>Total</small><strong>${NOC.App.money(total)}</strong></div></div>
   </div>
   ${pdfPanel()}
   <div class="modern-table-card"><div class="table-wrap modern-table-wrap"><table class="modern-data-table invoice-table"><thead><tr>
   <th class="modern-check-col"><input id="invoiceCheckAll" class="modern-check" type="checkbox" onchange="NOC.Facturas.toggleAllVisible(this.checked)"></th>
   ${head("numero","Nº")}${head("fecha","Fecha expedición")}${head("fecha_operacion","Fecha operación")}${head("cliente","Tienda")}${head("base","Base","num")}${head("iva","IVA","num")}${head("recargo","RE","num")}${head("total","Total","num")}${head("pago","Pago")}${head("proforma","Proforma")}<th>Acciones</th>
   </tr></thead><tbody>${rr.map(r=>`<tr><td class="modern-check-col"><input class="modern-check invoice-row-check" data-id="${r.id}" type="checkbox" ${selectedIds.has(r.id)?"checked":""} onchange="NOC.Facturas.toggle('${r.id}',this.checked)"></td><td><strong>${NOC.App.esc(r.numero)}</strong></td><td>${dateEs(r.fecha_expedicion||r.fecha)}</td><td>${dateEs(r.fecha_operacion||r.fecha)}</td><td>${NOC.App.esc(r.cliente_nombre_tienda||r.clientes?.nombre_tienda||"")}</td><td class="num">${NOC.App.money(r.base_imponible)}</td><td class="num">${NOC.App.money(r.iva)}</td><td class="num">${NOC.App.money(r.recargo)}</td><td class="num"><strong>${NOC.App.money(r.total)}</strong></td><td>${NOC.App.esc(r.forma_pago||"")}</td><td>${r.proformas?.id?`<button class="doc-link" onclick="NOC.Facturas.openProforma('${r.proformas.id}')">${NOC.App.esc(r.proformas.numero)}</button>`:(String(r.numero||"").startsWith("WEB")?"0":"—")}</td><td><button class="modern-icon-btn" onclick="NOC.Facturas.ver('${r.id}')"><svg class="noc-eye-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button></td></tr>`).join("")||`<tr><td colspan="12" class="empty">No hay resultados.</td></tr>`}</tbody></table></div></div></div>`;
   updateSelectionUi();
 }
 function search(inp){
   query=inp.value||"";
   const pos=inp.selectionStart??query.length;
   draw();
   requestAnimationFrame(()=>{
     const n=document.getElementById("invoiceSearch");
     if(n){
       n.value=query;
       n.focus({preventScroll:true});
       try{n.setSelectionRange(pos,pos)}catch(_){}
     }
   });
 }
 function setSort(k){sort=sort.key===k?{key:k,dir:sort.dir==="asc"?"desc":"asc"}:{key:k,dir:"asc"};draw()}
 function syncSelectionFromRange(){
   selectedIds=new Set(pdfRows().map(r=>r.id));
 }
 function updateSelectionUi(){
   const checks=[...document.querySelectorAll(".invoice-row-check")];
   checks.forEach(ch=>{ch.checked=selectedIds.has(ch.dataset.id)});
   const all=document.getElementById("invoiceCheckAll");
   if(all){
     const selectedVisible=checks.filter(ch=>ch.checked).length;
     all.checked=checks.length>0&&selectedVisible===checks.length;
     all.indeterminate=selectedVisible>0&&selectedVisible<checks.length;
   }
   const count=document.getElementById("invoicePdfCount");
   if(count)count.textContent=selectedIds.size;
   const btn=document.getElementById("invoicePdfBtn");
   if(btn)btn.disabled=selectedIds.size===0;
 }
 function toggle(id,on){
   if(on)selectedIds.add(id);else selectedIds.delete(id);
   updateSelectionUi();
 }
 function toggleAllVisible(on){
   shown().forEach(r=>on?selectedIds.add(r.id):selectedIds.delete(r.id));
   updateSelectionUi();
 }
 function pdfMode(v){
   pdfRange.mode=v==="numero"?"numero":"fecha";
   syncSelectionFromRange();
   draw();
 }
 function pdfField(k,v){
   pdfRange[k]=v||"";
   syncSelectionFromRange();
   draw();
 }
 async function generarPdfZip(){
   const sel=rows.filter(r=>selectedIds.has(r.id)).sort(numeroOrden);
   if(!sel.length)return NOC.App.toast("Selecciona una o varias facturas.");
   const rangeIds=new Set(pdfRows().map(r=>r.id));
   const matchesRange=rangeIds.size===selectedIds.size&&[...selectedIds].every(id=>rangeIds.has(id));
   let label=matchesRange?pdfRangeLabel().replace(/\s+a\s+/g,"_a_"):"";
   if(!label){
     label=sel.length===1?String(sel[0].numero||"seleccion"):`${sel[0]?.numero||"seleccion"}_a_${sel[sel.length-1]?.numero||""}`;
   }
   return NOC.Documentos.generarZip({tipo:"FACTURA",ids:sel.map(r=>r.id),zipName:`Facturas_${label}`});
 }
 async function openProforma(id){NOC.App.closeModal();await NOC.App.show("proformas");await NOC.Proformas.ver(id)}
 function imprimirActual(){ return NOC.Documentos.imprimirActual(); }
 async function ver(id){
   const {data:f,error}=await NOC.API.db().from("facturas").select("*, clientes(*), proformas(id,numero)").eq("id",id).single();if(error)throw error;
   const {data:ls,error:e}=await NOC.API.db().from("lineas_factura").select("*").eq("factura_id",id).order("orden");if(e)throw e;
   const config=await NOC.Documentos.getConfig(),html=NOC.Documentos.render({tipo:"FACTURA",doc:f,lineas:ls||[],config});
   const rel=f.proformas?.id?`<div class="document-relation"><span>Proforma de origen</span><button class="doc-link" onclick="NOC.Facturas.openProforma('${f.proformas.id}')">${NOC.App.esc(f.proformas.numero)}</button></div>`:"";
   NOC.App.modal(`<div class="modal-head"><strong>Factura ${NOC.App.esc(f.numero)} · ${NOC.App.esc(f.cliente_nombre_tienda||f.clientes?.nombre_tienda||"")}</strong><div style="display:flex;gap:8px;align-items:center"><button class="btn" onclick="NOC.Facturas.imprimirActual()">Imprimir / Guardar PDF</button><button class="icon-btn" onclick="NOC.App.closeModal()">×</button></div></div><div class="modal-body">${rel}${html}</div>`,false,"document-modal");
 }
 const todayLocal=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")};
 async function abrirVentaDirecta(){
   try{
     const {data,error}=await NOC.API.db().from("clientes").select("id,nombre_tienda,nombre,apellidos,tipo_fiscal").order("nombre_tienda");
     if(error)throw error;
     ventaClientes=data||[];
     const esc=NOC.App.esc, hoy=todayLocal();
     NOC.App.modal(`<div class="modal-head"><strong>Venta directa · nueva factura DIR</strong><button class="icon-btn" onclick="NOC.App.closeModal()">×</button></div>
     <div class="modal-body"><div style="max-width:860px;margin:auto;padding:12px 18px 24px">
       <p class="muted">Factura directa sin proforma. Introduce el precio final por unidad, IVA incluido. La aplicación calculará la base imponible. La serie DIR se asigna al guardar.</p>
       <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
       <label>Tipo de venta<select id="vdTipo" onchange="NOC.Facturas.filtrarClientesVD();NOC.Facturas.recalcularVD()"><option value="particular">Particular</option><option value="mayorista">Mayorista</option></select></label>
       <label>Cliente<select id="vdCliente"></select></label>
       <label>Fecha real de operación<input id="vdOperacion" type="date" value="${hoy}" max="${hoy}"></label>
       <label>Fecha de expedición (fecha real de emisión)<input id="vdExpedicion" type="date" value="${hoy}" max="${hoy}"></label>
       <label>Forma de pago<select id="vdPago"><option>Bizum</option><option>Transferencia</option><option>Tarjeta</option><option>Metálico</option><option>PayPal</option></select></label>
       <label id="vdZonaLabel">Destino fiscal de la entrega<select id="vdZona" onchange="NOC.Facturas.cambiarZonaVD()"><option value="general">Península y Baleares · IVA 21 %</option><option value="territorios">Canarias, Ceuta o Melilla · sin IVA español (con justificante de envío)</option></select></label>
       <label id="vdIvaLabel" style="display:none">IVA<select id="vdIva" onchange="NOC.Facturas.recalcularVD()"><option value="21">21 %</option><option value="10">10 %</option><option value="4">4 %</option><option value="0">0 %</option></select></label>
       <label id="vdReLabel" style="display:none">Recargo de equivalencia<select id="vdRe" onchange="NOC.Facturas.recalcularVD()"><option value="0">Sin recargo</option><option value="5.2">5,2 %</option><option value="1.4">1,4 %</option><option value="0.5">0,5 %</option></select></label>
       <label>Observaciones<input id="vdObs" placeholder="Ej.: Cobro Bizum; pedido adicional"></label></div>
       <p id="vdFiscalAviso" class="muted" style="font-size:12px">Precio final cobrado, transporte incluido. IVA general 21 %.</p>
       <p class="muted" style="font-size:12px">Artículo del catálogo (opcional): selecciona una referencia para copiar su descripción. El PVP se introduce manualmente, nunca se importa el precio mayorista.</p>
       <div style="margin-top:16px;overflow-x:auto"><table style="width:100%;border-collapse:collapse" id="vdTabla"><thead><tr><th>Artículo / descripción</th><th>Talla</th><th>Unidades</th><th>Precio final con IVA</th><th>Dto. %</th><th></th></tr></thead><tbody id="vdLineas"></tbody></table></div>
       <button class="btn" style="margin-top:10px" onclick="NOC.Facturas.anadirLineaVD()">+ Añadir artículo</button>
       <div id="vdTotales" style="text-align:right;margin:15px 0;font-weight:700"></div>
       <p class="muted" style="font-size:12px">Comprueba con la gestoría el tipo de factura, el IVA y la fecha real de emisión. Una vez creada, no se puede editar desde este formulario.</p>
       <div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn" onclick="NOC.App.closeModal()">Cancelar</button><button class="btn btn-primary" id="vdGuardar" onclick="NOC.Facturas.guardarVentaDirecta()">Crear factura DIR</button></div>
     </div></div>`,false,"document-modal");
     filtrarClientesVD();anadirLineaVD();cambiarZonaVD();
   }catch(e){NOC.App.toast("No se pudo abrir Venta directa: "+e.message)}
 }
 function filtrarClientesVD(){
   const tipo=document.getElementById("vdTipo")?.value||"particular",sel=document.getElementById("vdCliente");if(!sel)return;
   const filtered=ventaClientes.filter(c=>tipo==="particular"?String(c.nombre_tienda||"").trim().toLowerCase()==="particular":String(c.nombre_tienda||"").trim().toLowerCase()!=="particular");
   document.querySelectorAll("#vdTabla .vd-precio").forEach(el=>el.setAttribute("aria-label",tipo==="mayorista"?"Precio sin IVA":"Precio final con IVA"));
   const cab=document.querySelector("#vdTabla th:nth-child(4)");if(cab)cab.textContent=tipo==="mayorista"?"Precio sin IVA":"Precio final con IVA";
   document.getElementById("vdZonaLabel").style.display=tipo==="particular"?"":"none";
   document.getElementById("vdIvaLabel").style.display=tipo==="mayorista"?"":"none";
   document.getElementById("vdReLabel").style.display=tipo==="mayorista"?"":"none";
   if(tipo==="particular")cambiarZonaVD();
   sel.innerHTML='<option value="">Selecciona un cliente…</option>'+filtered.map(c=>`<option value="${NOC.App.esc(c.id)}">${NOC.App.esc(c.nombre_tienda||c.nombre||"")}</option>`).join("");
 }
 function cambiarZonaVD(){
   const tipo=document.getElementById("vdTipo")?.value;
   if(tipo!=="particular"){recalcularVD();return;}
   const fuera=document.getElementById("vdZona").value==="territorios";
   document.getElementById("vdIva").value=fuera?"0":"21";
   document.getElementById("vdRe").value="0";
   document.getElementById("vdFiscalAviso").textContent=fuera?
      "Sin IVA español SOLO para mercancías efectivamente enviadas a Canarias, Ceuta o Melilla. Conserva el justificante de transporte/salida. Se registrará el motivo en observaciones de factura.":
      "Península y Baleares: IVA 21 % incluido en el PVP. Transporte incluido en el precio.";
   recalcularVD();
 }
 async function buscarArticuloVD(input){
   const tr=input.closest("tr"),box=tr?.querySelector(".vd-sugerencias");if(!box)return;
   const query=input.value.trim();if(query.length<2){box.innerHTML="";return;}
   try{
     const items=await NOC.Articulos.search(query);
     if(!input.isConnected||input.value.trim()!==query)return;
     box.innerHTML=(items||[]).slice(0,12).map((a,i)=>`<button type="button" class="vd-item-catalogo" data-index="${i}" style="display:block;width:100%;text-align:left;padding:5px">${NOC.App.esc(a.nombre_producto)}</button>`).join("");
     box.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
       const a=items[Number(b.dataset.index)];tr.querySelector(".vd-desc").value=a.nombre_producto||"";
       box.innerHTML="";recalcularVD();
     }));
   }catch(e){box.textContent="No se pudo consultar el catálogo: "+e.message}
 }
 function anadirLineaVD(){
   const body=document.getElementById("vdLineas");if(!body)return;
   const tr=document.createElement("tr");tr.innerHTML=`<td><input aria-label="Buscar artículo NOC o escribir descripción" class="vd-desc" required style="width:100%;min-width:170px" placeholder="Buscar en catálogo o escribir…" oninput="NOC.Facturas.buscarArticuloVD(this)"><div class="vd-sugerencias" style="max-height:140px;overflow:auto"></div></td><td><input aria-label="Talla" class="vd-talla" style="width:75px"></td><td><input aria-label="Cantidad" class="vd-cantidad" type="number" min="1" step="1" value="1" style="width:65px" oninput="NOC.Facturas.recalcularVD()"></td><td><input aria-label="Precio final con IVA" class="vd-precio" type="number" min="0" step="0.01" value="0" style="width:100px" oninput="NOC.Facturas.recalcularVD()"></td><td><input aria-label="Descuento" class="vd-dto" type="number" min="0" max="100" step="0.01" value="0" style="width:70px" oninput="NOC.Facturas.recalcularVD()"></td><td><button class="btn" onclick="this.closest('tr').remove();NOC.Facturas.recalcularVD()">×</button></td>`;body.appendChild(tr);recalcularVD();
 }
 function lineasVD(){
   const iva=Number(document.getElementById("vdIva").value),re=Number(document.getElementById("vdRe").value);
   return [...document.querySelectorAll("#vdLineas tr")].map(tr=>{
     const precioFinal=Number(tr.querySelector(".vd-precio").value);
     const cantidad=Number(tr.querySelector(".vd-cantidad").value);
     const descuento=Number(tr.querySelector(".vd-dto").value);
     const baseUnitario=document.getElementById("vdTipo").value==="mayorista"?precioFinal:Math.round(precioFinal/(1+(iva+re)/100)*100)/100;
     return {descripcion:tr.querySelector(".vd-desc").value.trim(),tallaje:tr.querySelector(".vd-talla").value.trim(),cantidad,precio_unitario:baseUnitario,descuento,precioFinal};
   });
 }
 function importesVD(lineas){
   const pct=Number(document.getElementById("vdIva").value),rePct=Number(document.getElementById("vdRe").value);
   const base=Math.round(lineas.reduce((s,l)=>s+l.cantidad*l.precio_unitario*(1-l.descuento/100),0)*100)/100;
   const iva=Math.round(base*pct)/100,re=Math.round(base*rePct)/100;
   const esperado=document.getElementById("vdTipo").value==="mayorista"?Math.round((base+iva+re)*100)/100:Math.round(lineas.reduce((s,l)=>s+l.cantidad*l.precioFinal*(1-l.descuento/100),0)*100)/100;
   return {base,iva,re,total:Math.round((base+iva+re)*100)/100,esperado};
 }
 function recalcularVD(){
   const el=document.getElementById("vdTotales");if(!el)return;
   const {base,iva,re,total,esperado}=importesVD(lineasVD());
   const coincide=Math.abs(total-esperado)<0.005;
   el.innerHTML=`Base: ${base.toFixed(2)} € · IVA: ${iva.toFixed(2)} € · RE: ${re.toFixed(2)} € · <strong>TOTAL: ${total.toFixed(2)} €</strong>`+
     (coincide?"":`<div style="color:#a23d24;margin-top:6px">El redondeo no coincide con el importe cobrado (${esperado.toFixed(2)} €). Ajusta el desglose antes de crear la factura.</div>`);
 }
 async function guardarVentaDirecta(){
   const btn=document.getElementById("vdGuardar");if(!btn||btn.disabled)return;
   const cliente_id=document.getElementById("vdCliente").value,fecha_operacion=document.getElementById("vdOperacion").value,fecha_expedicion=document.getElementById("vdExpedicion").value,forma_pago=document.getElementById("vdPago").value,observaciones=document.getElementById("vdObs").value,iva_pct=Number(document.getElementById("vdIva").value),recargo_pct=Number(document.getElementById("vdRe").value),lineas=lineasVD();
   if(!cliente_id)return NOC.App.toast("Selecciona el cliente.");
   if(!fecha_operacion||!fecha_expedicion||fecha_operacion>fecha_expedicion||fecha_expedicion>todayLocal())return NOC.App.toast("Revisa las fechas reales de operación y expedición.");
   if(!lineas.length||lineas.some(l=>!l.descripcion||!Number.isInteger(l.cantidad)||l.cantidad<1||!Number.isFinite(l.precio_unitario)||l.precio_unitario<0||!Number.isFinite(l.descuento)||l.descuento<0||l.descuento>100))return NOC.App.toast("Revisa las líneas, cantidades, precios y descuentos.");
   const zona=document.getElementById("vdZona").value;
   const particular=document.getElementById("vdTipo").value==="particular";
   if(particular&&zona==="territorios"&&!confirm("Confirma que la mercancía se ha enviado efectivamente a Canarias, Ceuta o Melilla y que conservarás el justificante de salida/transporte. ¿Continuar?"))return;
   const motivoFiscal=particular&&zona==="territorios"?"Operación sin IVA español: entrega de bienes expedidos a Canarias, Ceuta o Melilla (art. 21 Ley 37/1992, según proceda). Justificante de expedición pendiente de conservar.":"";
   const observacionesFactura=[observaciones,motivoFiscal].filter(Boolean).join(" | ");
   const importes=importesVD(lineas);
   if(Math.abs(importes.total-importes.esperado)>=0.005)return NOC.App.toast("El total no coincide con lo cobrado por redondeo. Revisa las líneas.");
   if(!confirm("¿Crear y numerar definitivamente esta factura de Venta directa? Comprueba fechas, importes y datos del cliente."))return;
   btn.disabled=true;btn.textContent="Guardando…";
   try{
     const {data,error}=await NOC.API.db().rpc("crear_venta_directa_v483",{p_datos:{cliente_id,fecha_operacion,fecha_expedicion,forma_pago,observaciones:observacionesFactura,iva_pct,recargo_pct,lineas:lineas.map(({precioFinal,...l})=>l)}});
     if(error)throw error;
     NOC.App.closeModal();await render();NOC.App.toast("Venta directa creada: "+data.numero);
     await ver(data.id);
   }catch(e){NOC.App.toast("No se ha creado la factura: "+e.message)}finally{btn.disabled=false;btn.textContent="Crear factura DIR"}
 }
 return{render,ver,abrirVentaDirecta,filtrarClientesVD,cambiarZonaVD,buscarArticuloVD,anadirLineaVD,recalcularVD,guardarVentaDirecta,search,togglePagoFilter,setSort,openProforma,imprimirActual,pdfMode,pdfField,generarPdfZip,toggle,toggleAllVisible,updateSelectionUi,setFilter,clearFilters}
})();
