window.NOC=window.NOC||{};
NOC.Articulos=(()=>{
 let rows=[];
 async function render(search=""){
   rows=await NOC.API.list("articulos",{order:"created_at",ascending:false});
   const q=search.toLowerCase(),f=q?rows.filter(r=>[r.nombre_producto,r.sku,r.tipo_articulo,r.tipo_prenda,r.fabrica,r.estilo,r.anio,r.mes].join(" ").toLowerCase().includes(q)):rows;
   document.getElementById("viewContainer").innerHTML=`<div class="card"><div class="toolbar"><div class="toolbar-left"><input id="artSearch" placeholder="Buscar por nombre, SKU, fábrica, estilo…" value="${NOC.App.esc(search)}"></div><div class="toolbar-right"><button class="btn btn-primary" onclick="NOC.Articulos.openEditor()">+ Nuevo artículo</button></div></div>
   <div class="table-wrap"><table><thead><tr><th>Artículo</th><th>SKU</th><th>P. mayorista</th><th>Coste</th><th>Margen/u.</th><th>Tipo</th><th>Fábrica</th><th>Año</th><th>Mes</th><th>Acciones</th></tr></thead><tbody>
   ${f.map(r=>`<tr><td><strong>${NOC.App.esc(r.nombre_producto)}</strong><br><span class="muted">${NOC.App.esc(r.estilo||"")}</span></td><td>${NOC.App.esc(r.sku||"")}</td><td>${NOC.App.money(r.precio_venta)}</td><td>${NOC.App.money(r.precio_coste)}</td><td>${NOC.App.money(Number(r.precio_venta||0)-Number(r.precio_coste||0))}</td><td>${NOC.App.esc(r.tipo_prenda||r.tipo_articulo||"")}</td><td>${NOC.App.esc(r.fabrica||"")}</td><td>${r.anio??""}</td><td>${NOC.App.esc(r.mes||"")}</td><td class="actions"><button class="btn btn-small" onclick="NOC.Articulos.openEditor('${r.id}')">Editar</button><button class="btn btn-small btn-danger" onclick="NOC.Articulos.del('${r.id}')">Borrar</button></td></tr>`).join("")||`<tr><td colspan="10" class="empty">No hay artículos.</td></tr>`}
   </tbody></table></div></div>`;document.getElementById("artSearch").addEventListener("input",e=>render(e.target.value))
 }
 async function openEditor(id){const r=id?await NOC.API.one("articulos",id):{};NOC.App.modal(`<div class="modal-head"><strong>${id?"Editar artículo":"Nuevo artículo"}</strong><button class="icon-btn" onclick="NOC.App.closeModal()">×</button></div><div class="modal-body"><form id="artForm" class="form-grid">
 ${fld("nombre_producto","Nombre del producto",r.nombre_producto,"f8",true)}${fld("sku","SKU / referencia",r.sku,"f4")}
 ${num("precio_venta","Precio venta mayorista",r.precio_venta,"f3")}${num("precio_coste","Precio coste",r.precio_coste,"f3")}
 ${fld("tipo_articulo","Tipo de artículo",r.tipo_articulo,"f3")}${fld("tipo_prenda","Tipo de prenda",r.tipo_prenda,"f3")}${fld("estilo","Estilo",r.estilo,"f4")}${fld("fabrica","Fábrica",r.fabrica,"f4")}
 <div class="field f2"><label>Año</label><input name="anio" type="number" min="2000" max="2100" value="${r.anio??""}"></div>
 <div class="field f2"><label>Mes</label><select name="mes"><option value="">--</option>${Array.from({length:12},(_,i)=>String(i+1).padStart(2,"0")).map(m=>`<option value="${m}" ${r.mes===m?"selected":""}>${m}</option>`).join("")}</select></div>
 </form></div><div class="modal-foot"><button class="btn" onclick="NOC.App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="NOC.Articulos.save('${id||""}')">Guardar</button></div>`)}
 function fld(n,l,v,c,req=false){return `<div class="field ${c}"><label>${l}</label><input name="${n}" ${req?"required":""} value="${NOC.App.esc(v||"")}"></div>`}function num(n,l,v,c){return `<div class="field ${c}"><label>${l}</label><input name="${n}" type="number" step="0.01" value="${Number(v||0)}"></div>`}
 async function save(id){const f=Object.fromEntries(new FormData(document.getElementById("artForm")));if(!f.nombre_producto.trim())return NOC.App.toast("Nombre obligatorio.");f.precio_venta=Number(f.precio_venta||0);f.precio_coste=Number(f.precio_coste||0);f.anio=f.anio?Number(f.anio):null;f.mes=f.mes||null;if(id)await NOC.API.update("articulos",id,f);else await NOC.API.insert("articulos",f);NOC.App.closeModal();NOC.App.toast("Artículo guardado.");render()}
 async function del(id){if(confirm("¿Borrar artículo?")){await NOC.API.remove("articulos",id);render()}}
 async function search(term){let q=NOC.API.db().from("articulos").select("id,nombre_producto,precio_venta,sku").order("created_at",{ascending:false}).limit(25);if(term)q=q.ilike("nombre_producto",`%${term}%`);const {data,error}=await q;if(error)throw error;return data||[]}
 return{render,openEditor,save,del,search}
})();