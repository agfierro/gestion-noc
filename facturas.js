window.NOC=window.NOC||{};
NOC.Facturas=(()=>{
 let invoiceRows=[];
 let invoiceSort={key:"numero",dir:"desc"};
 let invoiceQuery="";

 function dateEs(v){
   if(!v)return"";
   const [y,m,d]=String(v).split("-");
   return `${d}/${m}/${y}`;
 }
 function sortValue(r,key){
   const values={
     numero:r.numero||"",
     fecha:r.fecha||"",
     cliente:r.clientes?.nombre_tienda||"",
     base:Number(r.base_imponible||0),
     iva:Number(r.iva||0),
     recargo:Number(r.recargo||0),
     total:Number(r.total||0),
     pago:r.forma_pago||"",
     proforma:r.proformas?.numero||""
   };
   return values[key];
 }
 function compareRows(a,b){
   const va=sortValue(a,invoiceSort.key),vb=sortValue(b,invoiceSort.key);
   let c=0;
   if(typeof va==="number"||typeof vb==="number")c=Number(va||0)-Number(vb||0);
   else c=String(va??"").localeCompare(String(vb??""),"es",{numeric:true,sensitivity:"base"});
   return invoiceSort.dir==="asc"?c:-c;
 }
 function filteredRows(){
   const q=invoiceQuery.trim().toLocaleLowerCase("es");
   return invoiceRows
     .filter(r=>{
       if(!q)return true;
       return String(r.numero||"").toLocaleLowerCase("es").includes(q)
         ||String(r.clientes?.nombre_tienda||"").toLocaleLowerCase("es").includes(q);
     })
     .sort(compareRows);
 }
 function sortHead(key,label,extra=""){
   const active=invoiceSort.key===key;
   return `<th class="${extra} sortable-th ${active?"sort-active":""}" onclick="NOC.Facturas.setSort('${key}')"><span>${label}</span><span class="sort-mark">${active?(invoiceSort.dir==="asc"?"↑":"↓"):"↕"}</span></th>`;
 }
 function stats(rows){
   return{
     count:rows.length,
     base:rows.reduce((s,r)=>s+Number(r.base_imponible||0),0),
     iva:rows.reduce((s,r)=>s+Number(r.iva||0),0),
     total:rows.reduce((s,r)=>s+Number(r.total||0),0)
   };
 }

 async function render(){
   const {data,error}=await NOC.API.db().from("facturas")
     .select("*, clientes(nombre_tienda), proformas(id,numero)")
     .order("created_at",{ascending:false});
   if(error)throw error;
   invoiceRows=data||[];
   draw();
 }

 function draw(){
   const rows=filteredRows();
   const st=stats(rows);
   document.getElementById("viewContainer").innerHTML=`<div class="noc-modern-page noc-facturas-modern">
     <div class="modern-page-head">
       <div>
         <div class="modern-kicker">GESTIÓN COMERCIAL</div>
         <h1>Facturas</h1>
         <p>Busca, ordena y consulta las facturas y su proforma de origen.</p>
       </div>
       <div class="modern-head-actions">
         <div class="modern-search">
           <span class="search-glyph">⌕</span>
           <input id="invoiceSearch" placeholder="Buscar por Nº o tienda…" value="${NOC.App.esc(invoiceQuery)}" oninput="NOC.Facturas.search(this.value)">
         </div>
       </div>
     </div>

     <div class="modern-kpis invoice-kpis">
       <div class="modern-kpi"><span class="kpi-icon">▤</span><div><small>Facturas</small><strong>${st.count}</strong></div></div>
       <div class="modern-kpi"><span class="kpi-icon">€</span><div><small>Base</small><strong>${NOC.App.money(st.base)}</strong></div></div>
       <div class="modern-kpi kpi-blue"><span class="kpi-icon">%</span><div><small>IVA</small><strong>${NOC.App.money(st.iva)}</strong></div></div>
       <div class="modern-kpi kpi-green"><span class="kpi-icon">Σ</span><div><small>Total</small><strong>${NOC.App.money(st.total)}</strong></div></div>
     </div>

     <div class="modern-table-card">
       <div class="table-wrap modern-table-wrap">
         <table class="modern-data-table invoice-table">
           <thead><tr>
             ${sortHead("numero","Nº")}
             ${sortHead("fecha","Fecha")}
             ${sortHead("cliente","Tienda")}
             ${sortHead("base","Base","num")}
             ${sortHead("iva","IVA","num")}
             ${sortHead("recargo","RE","num")}
             ${sortHead("total","Total","num")}
             ${sortHead("pago","Pago")}
             ${sortHead("proforma","Proforma")}
             <th>Acciones</th>
           </tr></thead>
           <tbody>
             ${rows.map(r=>`<tr>
               <td><strong class="doc-number">${NOC.App.esc(r.numero)}</strong></td>
               <td>${dateEs(r.fecha)}</td>
               <td>${NOC.App.esc(r.clientes?.nombre_tienda||"")}</td>
               <td class="num">${NOC.App.money(r.base_imponible)}</td>
               <td class="num">${NOC.App.money(r.iva)}</td>
               <td class="num">${NOC.App.money(r.recargo)}</td>
               <td class="num"><strong>${NOC.App.money(r.total)}</strong></td>
               <td>${NOC.App.esc(r.forma_pago||"")}</td>
               <td>${r.proformas?.id?`<button class="doc-link" title="Abrir proforma" onclick="NOC.Facturas.openLinkedProforma('${r.proformas.id}')">${NOC.App.esc(r.proformas.numero)}</button>`:`<span class="muted-link">${String(r.numero||"").startsWith("WEB")?"0":"—"}</span>`}</td>
               <td class="modern-actions">
                 <button class="modern-icon-btn" title="Ver factura" aria-label="Ver factura" onclick="NOC.Facturas.ver('${r.id}')">
                   <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 12s3.5-6 9.2-6 9.2 6 9.2 6-3.5 6-9.2 6-9.2-6-9.2-6Z"/><circle cx="12" cy="12" r="2.6"/></svg>
                 </button>
               </td>
             </tr>`).join("")||`<tr><td colspan="10" class="empty modern-empty">No hay facturas que coincidan con la búsqueda.</td></tr>`}
           </tbody>
         </table>
       </div>
     </div>
   </div>`;
 }
 function search(v){invoiceQuery=v||"";draw()}
 function setSort(key){
   if(invoiceSort.key===key)invoiceSort.dir=invoiceSort.dir==="asc"?"desc":"asc";
   else invoiceSort={key,dir:"asc"};
   draw();
 }
 async function openLinkedProforma(id){
   NOC.App.closeModal();
   await NOC.App.show("proformas");
   await NOC.Proformas.ver(id);
 }
 async function ver(id){
   const {data:f,error}=await NOC.API.db().from("facturas").select("*, clientes(*), proformas(id,numero)").eq("id",id).single();
   if(error)throw error;
   const {data:ls,error:e2}=await NOC.API.db().from("lineas_factura").select("*").eq("factura_id",id).order("orden");
   if(e2)throw e2;
   const config=await NOC.Documentos.getConfig();
   const html=NOC.Documentos.render({tipo:"FACTURA",doc:f,lineas:ls||[],config});
   const relation=f.proformas?.id
     ?`<div class="document-relation"><span>Proforma de origen</span><button class="doc-link" onclick="NOC.Facturas.openLinkedProforma('${f.proformas.id}')">${NOC.App.esc(f.proformas.numero)}</button></div>`
     :`<div class="document-relation"><span>Proforma de origen</span><strong>${String(f.numero||"").startsWith("WEB")?"0":"—"}</strong></div>`;
   NOC.App.modal(`<div class="modal-head"><strong>Factura ${NOC.App.esc(f.numero)}</strong><button class="icon-btn" onclick="NOC.App.closeModal()">×</button></div><div class="modal-body">${relation}${html}</div><div class="modal-foot"><button class="btn" onclick="window.print()">Imprimir / Guardar PDF</button></div>`,false,"document-modal");
 }
 return{render,ver,search,setSort,openLinkedProforma}
})();