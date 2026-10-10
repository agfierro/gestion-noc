window.NOC=window.NOC||{};
NOC.Articulos=(()=>{
 let rows=[];
 let sort={key:"articulo",dir:"asc"};
 async function render(search=""){
   rows=await NOC.API.list("articulos",{order:"created_at",ascending:false});
   const q=search.toLowerCase();
   let f=q?rows.filter(r=>[r.nombre_producto,r.tipo_articulo,r.tipo_prenda,r.fabrica,r.estilo,r.anio,r.mes].join(" ").toLowerCase().includes(q)):rows;
   f=[...f].sort(compareRows);

   document.getElementById("viewContainer").innerHTML=`<div class="card"><div class="toolbar"><div class="toolbar-left"><input id="artSearch" placeholder="Buscar por nombre, fábrica, estilo…" value="${NOC.App.esc(search)}"></div><div class="toolbar-right"><button class="btn btn-primary" onclick="NOC.Articulos.openEditor()">+ Nuevo artículo</button></div></div>
   <div class="table-wrap"><table><thead><tr>
      ${head("articulo","Artículo")}
      ${head("precio","P. mayorista")}
      ${head("coste","Coste")}
      ${head("margen","Margen/u.")}
      ${head("tipo_articulo","Tipo artículo")}
      ${head("tipo_prenda","Tipo de prenda")}
      ${head("fabrica","Fábrica")}
      ${head("fecha_lanzamiento","Fecha lanzamiento")}
      <th>Acciones</th>
   </tr></thead><tbody>
   ${f.map(r=>`<tr><td><strong>${NOC.App.esc(r.nombre_producto)}</strong><br><span class="muted">${NOC.App.esc(r.estilo||"")}</span></td><td>${NOC.App.money(r.precio_venta)}</td><td>${NOC.App.money(r.precio_coste)}</td><td>${NOC.App.money(Number(r.precio_venta||0)-Number(r.precio_coste||0))}</td><td>${NOC.App.esc(r.tipo_articulo||"")}</td><td>${NOC.App.esc(r.tipo_prenda||"")}</td><td>${NOC.App.esc(r.fabrica||"")}</td><td>${NOC.App.esc(fechaLanzamiento(r))}</td><td class="actions"><button class="btn btn-small" onclick="NOC.Articulos.openEditor('${r.id}')">Editar</button><button class="btn btn-small btn-danger" onclick="NOC.Articulos.del('${r.id}')">Borrar</button></td></tr>`).join("")||`<tr><td colspan="9" class="empty">No hay artículos.</td></tr>`}
   </tbody></table></div></div>`;
   document.getElementById("artSearch").addEventListener("input",async e=>{const v=e.target.value,pos=e.target.selectionStart;await render(v);const n=document.getElementById("artSearch");if(n){n.focus({preventScroll:true});try{n.setSelectionRange(pos,pos)}catch(_){}}})
 }

 function fechaLanzamiento(r){
   const y=String(r?.anio??"").trim();
   const m=String(r?.mes??"").trim();
   if(!y&&!m)return "";
   if(y&&!m)return y;
   if(!y&&m)return `--${m.padStart(2,"0")}`;
   return `${y}-${m.padStart(2,"0")}`;
 }
 function value(r,key){
   const margen=Number(r.precio_venta||0)-Number(r.precio_coste||0);
   return {
     articulo:r.nombre_producto||"",
     precio:Number(r.precio_venta||0),
     coste:Number(r.precio_coste||0),
     margen,
     tipo_articulo:r.tipo_articulo||"",
     tipo_prenda:r.tipo_prenda||"",
     fabrica:r.fabrica||"",
     fecha_lanzamiento:(Number(r.anio||0)*100)+Number(r.mes||0)
   }[key];
 }
 function compareRows(a,b){
   const va=value(a,sort.key),vb=value(b,sort.key);
   let c=(typeof va==="number"||typeof vb==="number")
     ?Number(va||0)-Number(vb||0)
     :String(va??"").localeCompare(String(vb??""),"es",{numeric:true,sensitivity:"base"});
   return sort.dir==="asc"?c:-c;
 }
 function head(key,label){
   const active=sort.key===key;
   return `<th class="sortable-th ${active?"sort-active":""}" onclick="NOC.Articulos.setSort('${key}')">${label} <span class="sort-mark">${active?(sort.dir==="asc"?"↑":"↓"):"↕"}</span></th>`;
 }
 function setSort(key){
   sort=sort.key===key?{key,dir:sort.dir==="asc"?"desc":"asc"}:{key,dir:"asc"};
   const search=document.getElementById("artSearch")?.value||"";
   render(search);
 }
 async function openEditor(id){const r=id?await NOC.API.one("articulos",id):{};NOC.App.modal(`<div class="modal-head"><strong>${id?"Editar artículo":"Nuevo artículo"}</strong><button class="icon-btn" onclick="NOC.App.closeModal()">×</button></div><div class="modal-body"><form id="artForm" class="form-grid">
 ${fld("nombre_producto","Nombre del producto",r.nombre_producto,"f8",true)}${fld("sku","SKU / referencia",r.sku,"f4")}
 ${num("precio_venta","Precio venta mayorista",r.precio_venta,"f3")}${num("precio_coste","Precio coste",r.precio_coste,"f3")}
 ${tipoArticuloSelect(r.tipo_articulo)}${fld("tipo_prenda","Tipo de prenda",r.tipo_prenda,"f3")}${fld("estilo","Estilo",r.estilo,"f4")}${fld("fabrica","Fábrica",r.fabrica,"f4")}
 <div class="field f2"><label>Año</label><input name="anio" type="number" min="2000" max="2100" value="${r.anio??""}"></div>
 <div class="field f2"><label>Mes</label><select name="mes"><option value="">--</option>${Array.from({length:12},(_,i)=>String(i+1).padStart(2,"0")).map(m=>`<option value="${m}" ${r.mes===m?"selected":""}>${m}</option>`).join("")}</select></div>
 </form></div><div class="modal-foot"><button class="btn" onclick="NOC.App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="NOC.Articulos.save('${id||""}')">Guardar</button></div>`)}
 function tipoArticuloSelect(v){
   const value=String(v||"").trim();
   const opciones=["Ropa","Complementos"];
   const extra=value&&!opciones.includes(value)?`<option value="${NOC.App.esc(value)}" selected>${NOC.App.esc(value)} (existente)</option>`:"";
   return `<div class="field f3"><label>Tipo de artículo</label><select name="tipo_articulo"><option value="">--</option>${extra}${opciones.map(o=>`<option value="${o}" ${value===o?"selected":""}>${o}</option>`).join("")}</select></div>`;
 }
 function fld(n,l,v,c,req=false){return `<div class="field ${c}"><label>${l}</label><input name="${n}" ${req?"required":""} value="${NOC.App.esc(v||"")}"></div>`}function num(n,l,v,c){return `<div class="field ${c}"><label>${l}</label><input name="${n}" type="number" step="0.01" value="${Number(v||0)}"></div>`}
 async function save(id){const f=Object.fromEntries(new FormData(document.getElementById("artForm")));if(!f.nombre_producto.trim())return NOC.App.toast("Nombre obligatorio.");f.precio_venta=Number(f.precio_venta||0);f.precio_coste=Number(f.precio_coste||0);f.anio=f.anio?Number(f.anio):null;f.mes=f.mes||null;if(id)await NOC.API.update("articulos",id,f);else await NOC.API.insert("articulos",f);NOC.App.closeModal();NOC.App.toast("Artículo guardado.");render()}
 async function del(id){if(confirm("¿Borrar artículo?")){await NOC.API.remove("articulos",id);render()}}
 async function search(term){let q=NOC.API.db().from("articulos").select("id,nombre_producto,precio_venta,sku").order("created_at",{ascending:false}).limit(25);if(term)q=q.ilike("nombre_producto",`%${term}%`);const {data,error}=await q;if(error)throw error;return data||[]}
 return{render,openEditor,save,del,search,setSort}
})();