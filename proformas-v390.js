window.NOC=window.NOC||{};
NOC.Proformas=(()=>{
 let selectedIds=new Set();
 const normalizarEstado=v=>String(v||"").trim().toLowerCase();
 const esEnviada=v=>normalizarEstado(v)==="enviada";
 const esCancelada=v=>normalizarEstado(v)==="cancelada";
 const esFacturada=v=>normalizarEstado(v)==="facturada";
 let pfRows=[];
 let pfInvoiceByProforma=new Map();
 let pfSort={key:"numero",dir:"desc"};

 async function render(){
   const db=NOC.API.db();
   const [{data,error},{data:facturas,error:fe}]=await Promise.all([
     db.from("proformas").select("*, clientes(nombre_tienda)").order("created_at",{ascending:false}),
     db.from("facturas").select("id,numero,proforma_id").not("proforma_id","is",null)
   ]);
   if(error)throw error;
   if(fe)throw fe;
   pfRows=data||[];
   pfInvoiceByProforma=new Map((facturas||[]).map(f=>[f.proforma_id,f]));
   drawModernPage();
 }

 function pfDateEs(v){
   if(!v)return"";
   const [y,m,d]=String(v).split("-");
   return `${d}/${m}/${y}`;
 }
 function pfStatusClass(v){
   const s=normalizarEstado(v);
   if(s==="facturada")return"status-facturada";
   if(s==="cancelada")return"status-cancelada";
   if(s==="enviada")return"status-enviada";
   return"status-pendiente";
 }
 function getPfFilters(){
   return{
     q:(document.getElementById("pfModernSearch")?.value||"").trim().toLocaleLowerCase("es"),
     desde:document.getElementById("pfFilterDesde")?.value||"",
     hasta:document.getElementById("pfFilterHasta")?.value||"",
     estado:document.getElementById("pfFilterEstado")?.value||"",
     pago:document.getElementById("pfFilterPago")?.value||""
   };
 }
 function filteredPfRows(){
   const f=getPfFilters();
   return pfRows.filter(r=>{
     const client=String(r.clientes?.nombre_tienda||"").toLocaleLowerCase("es");
     const num=String(r.numero||"").toLocaleLowerCase("es");
     if(f.q && !num.includes(f.q) && !client.includes(f.q))return false;
     if(f.desde && String(r.fecha)<f.desde)return false;
     if(f.hasta && String(r.fecha)>f.hasta)return false;
     if(f.estado && normalizarEstado(r.estado)!==normalizarEstado(f.estado))return false;
     if(f.pago && String(r.forma_pago||"Transferencia")!==f.pago)return false;
     return true;
   });
 }

 function pfSortValue(r,key){
   const factura=pfInvoiceByProforma.get(r.id);
   const values={
     numero:r.numero||"",
     fecha:r.fecha||"",
     cliente:r.clientes?.nombre_tienda||"",
     total:Number(r.total||0),
     estado:r.estado||"",
     pago:r.forma_pago||"Transferencia",
     factura:factura?.numero||""
   };
   return values[key];
 }
 function pfCompare(a,b){
   const va=pfSortValue(a,pfSort.key),vb=pfSortValue(b,pfSort.key);
   let c=0;
   if(typeof va==="number"||typeof vb==="number")c=Number(va||0)-Number(vb||0);
   else c=String(va??"").localeCompare(String(vb??""),"es",{numeric:true,sensitivity:"base"});
   return pfSort.dir==="asc"?c:-c;
 }
 function sortedPfRows(){
   return [...filteredPfRows()].sort(pfCompare);
 }
 function setSort(key){
   if(pfSort.key===key)pfSort.dir=pfSort.dir==="asc"?"desc":"asc";
   else pfSort={key,dir:"asc"};
   refreshModern();
 }
 function sortHead(key,label,extra=""){
   const active=pfSort.key===key;
   return `<th class="${extra} sortable-th ${active?"sort-active":""}" onclick="NOC.Proformas.setSort('${key}')"><span>${label}</span><span class="sort-mark">${active?(pfSort.dir==="asc"?"↑":"↓"):"↕"}</span></th>`;
 }
 function pfStats(rows){
   return{
     count:rows.length,
     total:rows.reduce((a,r)=>a+Number(r.total||0),0),
     enviadas:rows.filter(r=>esEnviada(r.estado)).length,
     facturadas:rows.filter(r=>esFacturada(r.estado)).length,
     canceladas:rows.filter(r=>esCancelada(r.estado)).length
   };
 }
 function drawModernPage(){
   const rows=sortedPfRows();
   const st=pfStats(rows);
   const pagos=[...new Set(pfRows.map(r=>String(r.forma_pago||"Transferencia")).filter(Boolean))].sort();
   const container=document.getElementById("viewContainer");
   container.innerHTML=`<div class="noc-modern-page noc-proformas-modern">
     <div class="modern-page-head">
       <div>
         <div class="modern-kicker">GESTIÓN COMERCIAL</div>
         <h1>Proformas</h1>
         <p>Consulta, filtra y gestiona tus documentos comerciales.</p>
       </div>
       <div class="modern-head-actions">
         <div class="modern-search">
           <span class="search-glyph">⌕</span>
           <input id="pfModernSearch" placeholder="Buscar por Nº o cliente…" value="${NOC.App.esc(getPfFilters().q||"")}" oninput="NOC.Proformas.refreshModern()">
         </div>
         <button class="btn btn-primary modern-new-btn" onclick="NOC.Proformas.openEditor()">＋ Nueva proforma</button>
       </div>
     </div>

     <div class="modern-filter-card">
       <div class="modern-filter-field"><label>Desde</label><input id="pfFilterDesde" type="date" onchange="NOC.Proformas.refreshModern()"></div>
       <div class="modern-filter-field"><label>Hasta</label><input id="pfFilterHasta" type="date" onchange="NOC.Proformas.refreshModern()"></div>
       <div class="modern-filter-field"><label>Estado</label><select id="pfFilterEstado" onchange="NOC.Proformas.refreshModern()"><option value="">Todos</option><option>Enviada</option><option>Facturada</option><option>Cancelada</option></select></div>
       <div class="modern-filter-field"><label>Pago</label><select id="pfFilterPago" onchange="NOC.Proformas.refreshModern()"><option value="">Todos</option>${pagos.map(x=>`<option>${NOC.App.esc(x)}</option>`).join("")}</select></div>
       <button class="btn modern-clear-btn" onclick="NOC.Proformas.clearModernFilters()">Limpiar filtros</button>
     </div>

     <div class="modern-kpis">
       <div class="modern-kpi"><span class="kpi-icon">▤</span><div><small>Proformas</small><strong>${st.count}</strong></div></div>
       <div class="modern-kpi"><span class="kpi-icon">€</span><div><small>Importe total</small><strong>${NOC.App.money(st.total)}</strong></div></div>
       <div class="modern-kpi kpi-blue"><span class="kpi-icon">↗</span><div><small>Enviadas</small><strong>${st.enviadas}</strong></div></div>
       <div class="modern-kpi kpi-green"><span class="kpi-icon">✓</span><div><small>Facturadas</small><strong>${st.facturadas}</strong></div></div>
       <div class="modern-kpi kpi-red"><span class="kpi-icon">×</span><div><small>Canceladas</small><strong>${st.canceladas}</strong></div></div>
     </div>

     <div class="modern-table-card">
       <div class="table-wrap modern-table-wrap">
         <table class="modern-data-table">
           <thead><tr>
             <th class="modern-check-col"><input class="modern-check" type="checkbox" onchange="NOC.Proformas.toggleAllVisible(this.checked)"></th>
             ${sortHead("numero","Nº")}${sortHead("fecha","Fecha")}${sortHead("cliente","Cliente")}${sortHead("total","Importe","num")}${sortHead("estado","Estado")}${sortHead("pago","Pago")}${sortHead("factura","Factura")}<th>Acciones</th>
           </tr></thead>
           <tbody>
           ${rows.map(r=>`<tr>
             <td class="modern-check-col"><input class="modern-check pf-row-check" data-id="${r.id}" type="checkbox" ${selectedIds.has(r.id)?"checked":""} onchange="NOC.Proformas.toggle('${r.id}',this.checked);NOC.Proformas.updateBulkBar()"></td>
             <td><strong class="doc-number">${NOC.App.esc(r.numero)}</strong></td>
             <td>${pfDateEs(r.fecha)}</td>
             <td>${NOC.App.esc(r.clientes?.nombre_tienda||"")}</td>
             <td class="num"><strong>${NOC.App.money(r.total)}</strong></td>
             <td><span class="modern-status ${pfStatusClass(r.estado)}">${NOC.App.esc(r.estado)}</span></td>
             <td>${NOC.App.esc(r.forma_pago||"Transferencia")}</td>
             <td>${pfInvoiceByProforma.get(r.id)?`<button class="doc-link" title="Abrir factura" onclick="NOC.Proformas.openLinkedInvoice('${pfInvoiceByProforma.get(r.id).id}')">${NOC.App.esc(pfInvoiceByProforma.get(r.id).numero)}</button>`:`<span class="muted-link">—</span>`}</td>
             <td class="modern-actions">
               <button class="modern-icon-btn" title="Ver proforma" aria-label="Ver proforma" onclick="NOC.Proformas.ver('${r.id}')">
                 <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 12s3.5-6 9.2-6 9.2 6 9.2 6-3.5 6-9.2 6-9.2-6-9.2-6Z"/><circle cx="12" cy="12" r="2.6"/></svg>
               </button>
               ${esEnviada(r.estado)?`<button class="modern-icon-btn" title="Editar" aria-label="Editar" onclick="NOC.Proformas.openEditor('${r.id}')">
                 <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.4-10.4a2.2 2.2 0 0 0-3.1-3.1L5 16.8 4 20Z"/><path d="m14 7.8 3.1 3.1"/></svg>
               </button>
               <button class="modern-icon-btn" title="Cambiar estado" aria-label="Cambiar estado" onclick="NOC.Proformas.openStatus('${r.id}')">
                 <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>
               </button>`:(esCancelada(r.estado)?`<button class="modern-icon-btn" title="Cambiar estado" aria-label="Cambiar estado" onclick="NOC.Proformas.openStatus('${r.id}')">
                 <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>
               </button>`:"")}
             </td>
           </tr>`).join("")||`<tr><td colspan="9" class="empty modern-empty">No hay proformas que coincidan con los filtros.</td></tr>`}
           </tbody>
         </table>
       </div>
       <div id="pfBulkBar" class="modern-bulk-bar">
         <span><strong>${selectedIds.size}</strong> seleccionada(s)</span>
         <div class="modern-bulk-actions">
           <button class="btn bulk-enviada" onclick="NOC.Proformas.bulkSetStatus('Enviada')">Marcar enviadas</button>
           <button class="btn bulk-facturada" onclick="NOC.Proformas.bulkSetStatus('Facturada')">Marcar facturadas</button>
           <button class="btn bulk-pendiente" onclick="NOC.Proformas.bulkSetStatus('Pendiente')">Marcar pendientes</button>
           <button class="btn bulk-cancelada" onclick="NOC.Proformas.bulkSetStatus('Cancelada')">Marcar canceladas</button>
           <button class="btn bulk-delete" onclick="NOC.Proformas.deleteSelected()">Eliminar</button>
           <button class="btn btn-primary bulk-invoice" onclick="NOC.Proformas.facturarSeleccionadas()">Facturar</button>
         </div>
       </div>
     </div>
   </div>`;

   // restore current filter values after redraw
   if(window._pfModernFilters){
     const f=window._pfModernFilters;
     ["Desde","Hasta","Estado","Pago"].forEach(k=>{
       const el=document.getElementById("pfFilter"+k);
       if(el)el.value=f[k.toLowerCase()]||"";
     });
     const s=document.getElementById("pfModernSearch");if(s)s.value=f.q||"";
   }
   updateBulkBar();
 }
 function refreshModern(){
   window._pfModernFilters=getPfFilters();
   drawModernPage();
 }
 function clearModernFilters(){
   window._pfModernFilters={q:"",desde:"",hasta:"",estado:"",pago:""};
   drawModernPage();
 }
 function toggleAllVisible(checked){
   filteredPfRows().forEach(r=>checked?selectedIds.add(r.id):selectedIds.delete(r.id));
   drawModernPage();
 }
 function updateBulkBar(){
   const bar=document.getElementById("pfBulkBar");
   if(!bar)return;
   const checked=[...document.querySelectorAll(".pf-row-check:checked")].map(el=>el.dataset.id).filter(Boolean);
   selectedIds=new Set(checked);
   bar.classList.toggle("has-selection",selectedIds.size>0);
   const count=bar.querySelector("span strong");if(count)count.textContent=selectedIds.size;
 }
 async function openEditor(id){
   if(id){
     const estadoActual=await NOC.API.one("proformas",id,"id,estado");
     if(esCancelada(estadoActual.estado)){
       NOC.App.alertMessage("Proforma cancelada","No puedes modificar esta proforma porque ha sido cancelada.","error");
       return;
     }
     if(esFacturada(estadoActual.estado)){
       NOC.App.toast("Una proforma facturada no se puede modificar.");
       return;
     }
   }
   const [clientes,envios]=await Promise.all([NOC.API.list("clientes",{order:"nombre_tienda",ascending:true}),NOC.API.list("tipos_envio",{eq:{activo:true},order:"orden",ascending:true})]);
   let p={fecha:NOC.App.today(),forma_pago:"Transferencia",estado:"Enviada"},lines=[];
   if(id){p=await NOC.API.one("proformas",id);const {data,error}=await NOC.API.db().from("lineas_proforma").select("*").eq("proforma_id",id).order("orden",{ascending:true});if(error)throw error;lines=(data||[]).filter(x=>!x.es_envio)}
   const pred=envios.find(e=>e.predeterminado);
   NOC.App.modal(`<div class="modal-head"><strong>${id?"Editar proforma":"Nueva proforma"}</strong><button class="icon-btn" onclick="NOC.App.closeModal()">×</button></div><div class="modal-body">
   <form id="pfForm" class="form-grid">
   <div class="field f4"><label>Cliente</label><select name="cliente_id" id="pfCliente" required><option value="">Seleccionar…</option>${clientes.map(c=>`<option value="${c.id}" ${p.cliente_id===c.id?"selected":""}>${NOC.App.esc(c.nombre_tienda)}</option>`).join("")}</select></div>
   <div class="field f3"><label>Fecha</label><input name="fecha" type="date" value="${p.fecha||NOC.App.today()}"></div>
   <div class="field f3"><label>Forma de pago</label><select name="forma_pago">${["Transferencia","Tarjeta","Bizum","PayPal"].map(x=>`<option ${p.forma_pago===x?"selected":""}>${x}</option>`).join("")}</select></div>
   <div class="field f2"><label>Estado</label><input value="${p.estado||"Enviada"}" disabled></div>
   <div class="field f6"><label>Tipo de envío</label><select id="pfEnvio" name="envio_id"><option value="">Seleccionar…</option>${envios.map(e=>`<option value="${e.id}" data-precio="${e.precio}" ${(p.envio_id===e.id||(!id&&!p.envio_id&&pred?.id===e.id))?"selected":""}>${NOC.App.esc(e.nombre)} · ${NOC.App.money(e.precio)}</option>`).join("")}</select></div>
   <div class="field f3"><label>Precio envío</label><input id="pfEnvioPrecio" name="envio_precio" type="number" step="0.01" value="${Number(p.envio_precio??pred?.precio??0)}"></div>
   <div class="field f3"><label>Descuento envío %</label><input name="envio_descuento" type="number" step="0.01" min="0" max="100" value="${Number(p.envio_descuento||0)}"></div>
   <div class="field f12"><label>Observaciones</label><textarea name="observaciones">${NOC.App.esc(p.observaciones||"")}</textarea></div>
   </form><div class="proforma-lines"><h3>Artículos</h3><div id="lineEditor"></div><button class="btn" onclick="NOC.Proformas.addLine()">+ Añadir línea</button></div></div>
   <div class="modal-foot"><button class="btn" onclick="NOC.App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="NOC.Proformas.save('${id||""}')">Guardar proforma</button></div>`);
   window._pfLines=lines.map((x,i)=>({...x,_key:i+1}));if(!window._pfLines.length)addLine();else drawLines();
   document.getElementById("pfEnvio").addEventListener("change",e=>{document.getElementById("pfEnvioPrecio").value=e.target.selectedOptions[0]?.dataset?.precio||0});
   document.getElementById("pfCliente").addEventListener("change",e=>{const c=clientes.find(x=>x.id===e.target.value);if(c?.envio_habitual_id){const s=document.getElementById("pfEnvio");s.value=c.envio_habitual_id;s.dispatchEvent(new Event("change"))}})
 }
 function addLine(){window._pfLines=window._pfLines||[];window._pfLines.push({_key:Date.now()+Math.random(),cantidad:1,descuento:0,tallaje:""});drawLines()}
 function removeLine(k){window._pfLines=window._pfLines.filter(x=>String(x._key)!==String(k));drawLines()}
 function patchLine(k,key,val){const l=window._pfLines.find(x=>String(x._key)===String(k));l[key]=["cantidad","descuento"].includes(key)?Number(val):val}
 function drawLines(){const box=document.getElementById("lineEditor");if(!box)return;box.innerHTML=window._pfLines.map(l=>`<div class="line-editor"><div class="field wide"><label>Artículo</label><input class="art-input" data-key="${l._key}" value="${NOC.App.esc(l.descripcion||"")}" placeholder="Escribe para buscar…"><div class="search-holder"></div></div><div class="field"><label>Cantidad</label><input type="number" step="1" value="${Number(l.cantidad??1)}" onchange="NOC.Proformas.patchLine('${l._key}','cantidad',this.value)"></div><div class="field"><label>Dto. %</label><input type="number" min="0" max="100" value="${Number(l.descuento||0)}" onchange="NOC.Proformas.patchLine('${l._key}','descuento',this.value)"></div><div class="field"><label>Tallaje</label><input value="${NOC.App.esc(l.tallaje||"")}" onchange="NOC.Proformas.patchLine('${l._key}','tallaje',this.value)"></div><button class="btn btn-danger" onclick="NOC.Proformas.removeLine('${l._key}')">×</button></div>`).join("");box.querySelectorAll(".art-input").forEach(i=>{i.addEventListener("input",()=>searchFor(i));i.addEventListener("focus",()=>searchFor(i))})}
 async function searchFor(inp){const items=await NOC.Articulos.search(inp.value.trim()),h=inp.parentElement.querySelector(".search-holder");h.innerHTML=`<div class="search-results">${items.map(a=>`<div class="search-result" data-id="${a.id}" data-name="${NOC.App.esc(a.nombre_producto)}" data-price="${a.precio_venta}"><span>${NOC.App.esc(a.nombre_producto)}</span><strong>${NOC.App.money(a.precio_venta)}</strong></div>`).join("")}</div>`;h.querySelectorAll(".search-result").forEach(el=>el.addEventListener("click",()=>{const l=window._pfLines.find(x=>String(x._key)===String(inp.dataset.key));Object.assign(l,{articulo_id:el.dataset.id,descripcion:el.dataset.name,precio_unitario:Number(el.dataset.price)});h.innerHTML="";drawLines()}))}
 function isCanariasCliente(c){
  const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
  const fiscal=norm(c?.tipo_fiscal);
  const provFact=norm(c?.provincia_facturacion);
  const provEnt=norm(c?.provincia_entrega);
  const cpFact=String(c?.cp_facturacion||"").trim();
  const cpEnt=String(c?.cp_entrega||"").trim();

  if(fiscal==="canarias")return true;

  const provinciasCanarias=["las palmas","santa cruz de tenerife","canarias"];
  if(provinciasCanarias.some(p=>provFact.includes(p)||provEnt.includes(p)))return true;

  if(/^(35|38)\d{3}$/.test(cpFact)||/^(35|38)\d{3}$/.test(cpEnt))return true;

  return false;
}

function taxFor(c){
  if(isCanariasCliente(c))return{iva:0,re:0};
  if(c?.tipo_fiscal==="Autónomo con RE")return{iva:.21,re:.052};
  return{iva:.21,re:0};
}
 async function save(id){
  const form=Object.fromEntries(new FormData(document.getElementById("pfForm")));
  if(!form.cliente_id)return NOC.App.toast("Selecciona un cliente.");
  const lines=(window._pfLines||[]).filter(x=>x.articulo_id&&Number(x.cantidad)!==0);
  if(!lines.length)return NOC.App.toast("Añade al menos un artículo.");
  if(lines.some(l=>!Number.isFinite(Number(l.cantidad))||Number(l.cantidad)===0)){
    return NOC.App.alertMessage("Cantidad incorrecta","La cantidad de una línea no puede ser 0. Para un abono utiliza una cantidad negativa, por ejemplo -1.","error");
  }
  const cli=await NOC.API.one("clientes",form.cliente_id),tax=taxFor(cli);form.envio_precio=Number(form.envio_precio||0);form.envio_descuento=Number(form.envio_descuento||0);if(!form.envio_id)form.envio_id=null;
  let base=lines.reduce((s,l)=>s+Number(l.precio_unitario||0)*Number(l.cantidad||0)*(1-Number(l.descuento||0)/100),0);base+=form.envio_precio*(1-form.envio_descuento/100);const iva=base*tax.iva,re=base*tax.re,total=base+iva+re;Object.assign(form,{base_imponible:base,iva,recargo:re,total});
  let pf;if(id){pf=await NOC.API.update("proformas",id,form);await NOC.API.db().from("lineas_proforma").delete().eq("proforma_id",id)}else{const numero=await NOC.API.rpc("siguiente_numero_proforma");pf=await NOC.API.insert("proformas",{...form,numero,estado:"Enviada"})}
  const payload=lines.map((l,i)=>({proforma_id:pf.id,articulo_id:l.articulo_id,descripcion:l.descripcion,precio_unitario:Number(l.precio_unitario||0),cantidad:Number(l.cantidad??1),descuento:Number(l.descuento||0),tallaje:l.tallaje||"",orden:i+1,es_envio:false}));
  let env="Gastos de envío";if(form.envio_id){try{env=(await NOC.API.one("tipos_envio",form.envio_id)).nombre}catch{}}
  payload.push({proforma_id:pf.id,articulo_id:null,descripcion:env,precio_unitario:form.envio_precio,cantidad:1,descuento:form.envio_descuento,tallaje:"",orden:9999,es_envio:true});const {error}=await NOC.API.db().from("lineas_proforma").insert(payload);if(error)throw error;
  NOC.App.closeModal();NOC.App.toast("Proforma guardada.");render()
 }
 function toggle(id,on){
   if(on)selectedIds.add(id);else selectedIds.delete(id);
 }
 function selectedFromScreen(){
   const domIds=[...document.querySelectorAll(".pf-row-check:checked")]
     .map(el=>el.dataset.id)
     .filter(Boolean);
   if(domIds.length){
     selectedIds=new Set(domIds);
   }
   return [...selectedIds];
 }
 async function bulkSetStatus(status){
   const ids=selectedFromScreen();
   if(!ids.length){
     return NOC.App.alertMessage(
       "No hay proformas seleccionadas",
       `Marca una o varias proformas antes de usar “Marcar ${String(status).toLowerCase()}”.`,
       "info"
     );
   }

   const label=String(status);
   NOC.App.showProgress("Actualizando proformas…",`${ids.length} seleccionada(s) · ${label}`);
   try{
     let ok=0;
     for(const id of ids){
       await NOC.API.update("proformas",id,{estado:label});
       ok++;
     }
     selectedIds.clear();
     NOC.App.hideProgress();
     await render();
     NOC.App.alertMessage(
       "Estado actualizado",
       `${ok} proforma(s) se han marcado como ${label}.`,
       "success"
     );
   }catch(e){
     NOC.App.hideProgress();
     NOC.App.alertMessage(
       "Error al actualizar",
       e?.message||String(e)||"No se ha podido cambiar el estado de las proformas.",
       "error"
     );
   }
 }
 async function deleteSelected(){
   const ids=selectedFromScreen();
   if(!ids.length)return NOC.App.alertMessage("No hay proformas seleccionadas","Marca una o varias proformas antes de eliminar.","info");
   if(!confirm(`¿Eliminar definitivamente ${ids.length} proforma(s) seleccionada(s)?`))return;
   NOC.App.showProgress("Eliminando proformas…",`${ids.length} seleccionada(s)`);
   try{
     const db=NOC.API.db();
     const {error:e1}=await db.from("lineas_proforma").delete().in("proforma_id",ids);
     if(e1)throw e1;
     const {error:e2}=await db.from("proformas").delete().in("id",ids);
     if(e2)throw e2;
     selectedIds.clear();
     NOC.App.hideProgress();
     await render();
     NOC.App.alertMessage("Proformas eliminadas",`${ids.length} proforma(s) eliminada(s).`,"success");
   }catch(e){
     NOC.App.hideProgress();
     NOC.App.alertMessage("No se pudieron eliminar",e.message||String(e),"error");
   }
 }
 async function openLinkedInvoice(id){
   NOC.App.closeModal();
   await NOC.App.show("facturas");
   await NOC.Facturas.ver(id);
 }
 function openStatus(id){NOC.App.modal(`<div class="modal-head"><strong>Cambiar estado</strong><button class="icon-btn" onclick="NOC.App.closeModal()">×</button></div><div class="modal-body"><select id="statusSelect"><option>Enviada</option><option>Pendiente</option><option>Cancelada</option><option>Facturada</option></select></div><div class="modal-foot"><button class="btn btn-primary" onclick="NOC.Proformas.setStatus('${id}',document.getElementById('statusSelect').value)">Aplicar</button></div>`,true)}
 function openBulkStatus(){if(!selectedIds.size)return NOC.App.toast("Selecciona proformas.");NOC.App.modal(`<div class="modal-head"><strong>Cambiar estado (${selectedIds.size})</strong><button class="icon-btn" onclick="NOC.App.closeModal()">×</button></div><div class="modal-body"><select id="bulkStatus"><option>Enviada</option><option>Pendiente</option><option>Cancelada</option><option>Facturada</option></select></div><div class="modal-foot"><button class="btn btn-primary" onclick="NOC.Proformas.applyBulkStatus()">Aplicar</button></div>`,true)}
 async function setStatus(id,s){await NOC.API.update("proformas",id,{estado:s});NOC.App.closeModal();render()}
 async function applyBulkStatus(){const s=document.getElementById("bulkStatus").value;for(const id of selectedIds)await NOC.API.update("proformas",id,{estado:s});selectedIds.clear();NOC.App.closeModal();render()}
 async function facturar(id){
  NOC.App.showProgress("Generando factura…","Comprobando estado y asignando número correlativo");
  try{
    const data=await NOC.API.rpc("facturar_proforma_atomica",{p_proforma_id:id,p_fecha_factura:NOC.App.today()});
    NOC.App.hideProgress();
    const numero=Array.isArray(data)?data[0]?.numero_factura:data?.numero_factura;
    await render();
    NOC.App.alertMessage("Factura creada",numero?`Se ha creado correctamente la factura ${numero}.`:"La factura se ha creado correctamente.","success");
    return true;
  }catch(e){
    NOC.App.hideProgress();
    const msg=String(e?.message||e||"");
    if(/cancelad/i.test(msg))NOC.App.alertMessage("Proforma cancelada","No puedes facturar esta proforma porque ha sido cancelada.","error");
    else if(/ya esta facturada|ya está facturada/i.test(msg))NOC.App.alertMessage("Proforma ya facturada","Esta proforma ya está facturada.","info");
    else NOC.App.alertMessage("Error al facturar",msg||"No se ha podido crear la factura.","error");
    return false;
  }
}
 async function facturarSeleccionadas(){
  if(!selectedIds.size)return NOC.App.toast("Selecciona proformas.");
  const seleccionadas=[];
  for(const id of [...selectedIds]){
    try{seleccionadas.push(await NOC.API.one("proformas",id,"id,numero,estado"));}catch(e){console.error(e)}
  }
  const num=v=>{const m=String(v||"").match(/(\d+)$/);return m?Number(m[1]):Number.MAX_SAFE_INTEGER};
  seleccionadas.sort((a,b)=>num(a.numero)-num(b.numero)||String(a.numero||"").localeCompare(String(b.numero||""),"es",{numeric:true}));
  let facturadas=0,bloqueadas=0,errores=0;const creadas=[];
  NOC.App.showProgress("Facturando proformas…",`0 de ${seleccionadas.length}`);
  for(let i=0;i<seleccionadas.length;i++){
    const p=seleccionadas[i];NOC.App.updateProgress("Facturando proformas…",`${i+1} de ${seleccionadas.length} · ${p.numero||""}`);
    if(String(p.estado||"").trim().toLowerCase()!=="enviada"){bloqueadas++;continue}
    try{
      const data=await NOC.API.rpc("facturar_proforma_atomica",{p_proforma_id:p.id,p_fecha_factura:NOC.App.today()});
      const numero=Array.isArray(data)?data[0]?.numero_factura:data?.numero_factura;
      facturadas++;creadas.push(`${p.numero} → ${numero||"Factura creada"}`);
    }catch(e){const msg=String(e?.message||e||"");if(/cancelad|facturada|estado enviada/i.test(msg))bloqueadas++;else{console.error(e);errores++}}
  }
  selectedIds.clear();NOC.App.hideProgress();await render();
  let mensaje=`Facturadas: ${facturadas}.`;if(bloqueadas)mensaje+=` Omitidas: ${bloqueadas} por no estar Enviadas.`;if(errores)mensaje+=` Errores: ${errores}.`;if(creadas.length)mensaje+=` Orden aplicado: ${creadas.join(" · ")}.`;
  NOC.App.alertMessage("Facturación masiva finalizada",mensaje,errores?"error":"success");
}
 async function ver(id){
  const {data:p,error}=await NOC.API.db().from("proformas").select("*, clientes(*)").eq("id",id).single();
  if(error)throw error;
  const {data:ls,error:e2}=await NOC.API.db().from("lineas_proforma").select("*").eq("proforma_id",id).order("orden");
  if(e2)throw e2;
  const config=await NOC.Documentos.getConfig();
  const html=NOC.Documentos.render({tipo:"PROFORMA",doc:p,lineas:ls||[],config});
  const {data:fact}=await NOC.API.db().from("facturas").select("id,numero").eq("proforma_id",id).maybeSingle();
  const relation=fact?`<div class="document-relation"><span>Factura vinculada</span><button class="doc-link" onclick="NOC.Proformas.openLinkedInvoice('${fact.id}')">${NOC.App.esc(fact.numero)}</button></div>`:"";
  NOC.App.modal(`<div class="modal-head"><strong>Proforma ${NOC.App.esc(p.numero)}</strong><button class="icon-btn" onclick="NOC.App.closeModal()">×</button></div><div class="modal-body">${relation}${html}</div><div class="modal-foot"><button class="btn" onclick="window.print()">Imprimir / Guardar PDF</button></div>`,false,"document-modal");
}
 return{render,openEditor,addLine,removeLine,patchLine,save,toggle,openStatus,openBulkStatus,setStatus,applyBulkStatus,facturar,facturarSeleccionadas,ver,refreshModern,clearModernFilters,toggleAllVisible,updateBulkBar,bulkSetStatus,deleteSelected,selectedFromScreen,setSort,openLinkedInvoice}
})();