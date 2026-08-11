window.NOC=window.NOC||{};
NOC.Facturas=(()=>{
 let rows=[],query="",sort={key:"numero",dir:"desc"};
 const dateEs=v=>{if(!v)return"";const [y,m,d]=String(v).split("-");return `${d}/${m}/${y}`};
 const value=(r,k)=>({numero:r.numero||"",fecha:r.fecha||"",cliente:r.clientes?.nombre_tienda||"",
   base:Number(r.base_imponible||0),iva:Number(r.iva||0),recargo:Number(r.recargo||0),
   total:Number(r.total||0),pago:r.forma_pago||"",proforma:r.proformas?.numero||""})[k];
 function compare(a,b){const va=value(a,sort.key),vb=value(b,sort.key);let c=(typeof va==="number"||typeof vb==="number")?Number(va||0)-Number(vb||0):String(va??"").localeCompare(String(vb??""),"es",{numeric:true,sensitivity:"base"});return sort.dir==="asc"?c:-c}
 function shown(){const q=query.trim().toLocaleLowerCase("es");return rows.filter(r=>!q||String(r.numero||"").toLocaleLowerCase("es").includes(q)||String(r.clientes?.nombre_tienda||"").toLocaleLowerCase("es").includes(q)).sort(compare)}
 function head(k,t,cl=""){const a=sort.key===k;return `<th class="${cl} sortable-th ${a?"sort-active":""}" onclick="NOC.Facturas.setSort('${k}')">${t} <span class="sort-mark">${a?(sort.dir==="asc"?"↑":"↓"):"↕"}</span></th>`}
 async function render(){
   const {data,error}=await NOC.API.db().from("facturas").select("*, clientes(nombre_tienda), proformas(id,numero)").order("created_at",{ascending:false});
   if(error)throw error;rows=data||[];draw();
 }
 function draw(){
   const rr=shown(),base=rr.reduce((s,r)=>s+Number(r.base_imponible||0),0),iva=rr.reduce((s,r)=>s+Number(r.iva||0),0),total=rr.reduce((s,r)=>s+Number(r.total||0),0);
   document.getElementById("viewContainer").innerHTML=`<div class="noc-modern-page noc-facturas-modern">
   <div class="modern-page-head"><div><div class="modern-kicker">GESTIÓN COMERCIAL</div><h1>Facturas</h1><p>Consulta, busca y ordena tus facturas.</p></div>
   <div class="modern-head-actions"><div class="modern-search"><span class="search-glyph">⌕</span><input id="invoiceSearch" placeholder="Buscar por Nº o tienda…" value="${NOC.App.esc(query)}" oninput="NOC.Facturas.search(this)"></div></div></div>
   <div class="modern-kpis invoice-kpis">
    <div class="modern-kpi"><span class="kpi-icon">▤</span><div><small>Facturas</small><strong>${rr.length}</strong></div></div>
    <div class="modern-kpi"><span class="kpi-icon">€</span><div><small>Base</small><strong>${NOC.App.money(base)}</strong></div></div>
    <div class="modern-kpi kpi-blue"><span class="kpi-icon">%</span><div><small>IVA</small><strong>${NOC.App.money(iva)}</strong></div></div>
    <div class="modern-kpi kpi-green"><span class="kpi-icon">Σ</span><div><small>Total</small><strong>${NOC.App.money(total)}</strong></div></div>
   </div>
   <div class="modern-table-card"><div class="table-wrap modern-table-wrap"><table class="modern-data-table invoice-table"><thead><tr>
   ${head("numero","Nº")}${head("fecha","Fecha")}${head("cliente","Tienda")}${head("base","Base","num")}${head("iva","IVA","num")}${head("recargo","RE","num")}${head("total","Total","num")}${head("pago","Pago")}${head("proforma","Proforma")}<th>Acciones</th>
   </tr></thead><tbody>${rr.map(r=>`<tr><td><strong>${NOC.App.esc(r.numero)}</strong></td><td>${dateEs(r.fecha)}</td><td>${NOC.App.esc(r.clientes?.nombre_tienda||"")}</td><td class="num">${NOC.App.money(r.base_imponible)}</td><td class="num">${NOC.App.money(r.iva)}</td><td class="num">${NOC.App.money(r.recargo)}</td><td class="num"><strong>${NOC.App.money(r.total)}</strong></td><td>${NOC.App.esc(r.forma_pago||"")}</td><td>${r.proformas?.id?`<button class="doc-link" onclick="NOC.Facturas.openProforma('${r.proformas.id}')">${NOC.App.esc(r.proformas.numero)}</button>`:(String(r.numero||"").startsWith("WEB")?"0":"—")}</td><td><button class="modern-icon-btn" onclick="NOC.Facturas.ver('${r.id}')"><svg class="noc-eye-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button></td></tr>`).join("")||`<tr><td colspan="10" class="empty">No hay resultados.</td></tr>`}</tbody></table></div></div></div>`;
 }
 function search(inp){query=inp.value||"";const pos=inp.selectionStart;draw();const n=document.getElementById("invoiceSearch");if(n){n.focus({preventScroll:true});try{n.setSelectionRange(pos,pos)}catch(_){}}}
 function setSort(k){sort=sort.key===k?{key:k,dir:sort.dir==="asc"?"desc":"asc"}:{key:k,dir:"asc"};draw()}
 async function openProforma(id){NOC.App.closeModal();await NOC.App.show("proformas");await NOC.Proformas.ver(id)}
 async function ver(id){
   const {data:f,error}=await NOC.API.db().from("facturas").select("*, clientes(*), proformas(id,numero)").eq("id",id).single();if(error)throw error;
   const {data:ls,error:e}=await NOC.API.db().from("lineas_factura").select("*").eq("factura_id",id).order("orden");if(e)throw e;
   const config=await NOC.Documentos.getConfig(),html=NOC.Documentos.render({tipo:"FACTURA",doc:f,lineas:ls||[],config});
   const rel=f.proformas?.id?`<div class="document-relation"><span>Proforma de origen</span><button class="doc-link" onclick="NOC.Facturas.openProforma('${f.proformas.id}')">${NOC.App.esc(f.proformas.numero)}</button></div>`:`<div class="document-relation"><span>Proforma de origen</span><strong>${String(f.numero||"").startsWith("WEB")?"0":"—"}</strong></div>`;
   NOC.App.modal(`<div class="modal-head"><strong>Factura ${NOC.App.esc(f.numero)}</strong><button class="icon-btn" onclick="NOC.App.closeModal()">×</button></div><div class="modal-body">${rel}${html}</div><div class="modal-foot"><button class="btn" onclick="window.print()">Imprimir / Guardar PDF</button></div>`,false,"document-modal");
 }
 return{render,ver,search,setSort,openProforma}
})();