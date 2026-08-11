window.NOC=window.NOC||{};
NOC.Clientes=(()=>{
 let rows=[];
 let sort={key:"tienda",dir:"asc"};
 async function render(search=""){
   rows=await NOC.API.list("clientes",{order:"nombre_tienda",ascending:true});
   const q=search.toLowerCase();
   let f=q?rows.filter(r=>[r.nombre_tienda,r.nombre,r.apellidos,r.localidad_facturacion,r.provincia_facturacion,r.comercial,r.tipo_fiscal].join(" ").toLowerCase().includes(q)):rows;
   f=[...f].sort(compareRows);

   document.getElementById("viewContainer").innerHTML=`<div class="card">
    <div class="toolbar"><div class="toolbar-left"><input id="clienteSearch" placeholder="Buscar cliente, localidad, provincia…" value="${NOC.App.esc(search)}"></div><div class="toolbar-right"><button class="btn btn-primary" onclick="NOC.Clientes.openEditor()">+ Nuevo cliente</button></div></div>
    <div class="table-wrap"><table><thead><tr>
      ${head("tienda","Tienda")}
      ${head("contacto","Contacto")}
      ${head("localidad","Localidad")}
      ${head("provincia","Provincia")}
      ${head("comercial","Comercial")}
      ${head("fiscal","Fiscal")}
      <th>Acciones</th>
    </tr></thead><tbody>
    ${f.map(r=>`<tr><td><strong>${NOC.App.esc(r.nombre_tienda||"")}</strong></td><td>${NOC.App.esc([r.nombre,r.apellidos].filter(Boolean).join(" "))}<br><span class="muted">${NOC.App.esc(r.email||"")}</span></td><td>${NOC.App.esc(r.localidad_facturacion||"")}</td><td>${NOC.App.esc(r.provincia_facturacion||"")}</td><td>${NOC.App.esc(r.comercial||"")}</td><td>${NOC.App.esc(r.tipo_fiscal||"")}</td><td class="actions"><button class="btn btn-small" onclick="NOC.Clientes.openEditor('${r.id}')">Editar</button><button class="btn btn-small btn-danger" onclick="NOC.Clientes.del('${r.id}')">Eliminar</button></td></tr>`).join("")||`<tr><td colspan="7" class="empty">No hay clientes.</td></tr>`}
    </tbody></table></div></div>`;
   document.getElementById("clienteSearch").addEventListener("input",async e=>{const v=e.target.value,pos=e.target.selectionStart;await render(v);const n=document.getElementById("clienteSearch");if(n){n.focus({preventScroll:true});try{n.setSelectionRange(pos,pos)}catch(_){}}})
 }

 function value(r,key){
   return {
     tienda:r.nombre_tienda||"",
     contacto:[r.nombre,r.apellidos,r.email].filter(Boolean).join(" "),
     localidad:r.localidad_facturacion||"",
     provincia:r.provincia_facturacion||"",
     comercial:r.comercial||"",
     fiscal:r.tipo_fiscal||""
   }[key];
 }
 function compareRows(a,b){
   const c=String(value(a,sort.key)??"").localeCompare(String(value(b,sort.key)??""),"es",{numeric:true,sensitivity:"base"});
   return sort.dir==="asc"?c:-c;
 }
 function head(key,label){
   const active=sort.key===key;
   return `<th class="sortable-th ${active?"sort-active":""}" onclick="NOC.Clientes.setSort('${key}')">${label} <span class="sort-mark">${active?(sort.dir==="asc"?"↑":"↓"):"↕"}</span></th>`;
 }
 function setSort(key){
   sort=sort.key===key?{key,dir:sort.dir==="asc"?"desc":"asc"}:{key,dir:"asc"};
   const search=document.getElementById("clienteSearch")?.value||"";
   render(search);
 }
 async function openEditor(id){
   const r=id?await NOC.API.one("clientes",id):{};
   const env=await NOC.API.list("tipos_envio",{eq:{activo:true},order:"orden",ascending:true});
   NOC.App.modal(`<div class="modal-head"><strong>${id?"Editar cliente":"Nuevo cliente"}</strong><button class="icon-btn" onclick="NOC.App.closeModal()">×</button></div>
   <div class="modal-body"><form id="clienteForm" class="form-grid">
   ${fld("nombre","Nombre",r.nombre,"f4")}${fld("apellidos","Apellidos",r.apellidos,"f4")}${fld("nombre_tienda","Nombre de tienda",r.nombre_tienda,"f4",true)}
   ${fld("telefono","Teléfono",r.telefono,"f4")}${fld("email","Email",r.email,"f4")}${fld("dni_cif","DNI/CIF",r.dni_cif,"f4")}
   ${fld("direccion_facturacion","Dirección facturación",r.direccion_facturacion,"f6")}${fld("cp_facturacion","Cód. postal",r.cp_facturacion,"f3")}${fld("localidad_facturacion","Localidad",r.localidad_facturacion,"f3")}
   ${fld("provincia_facturacion","Provincia",r.provincia_facturacion,"f4")}${fld("direccion_entrega","Dirección entrega",r.direccion_entrega,"f8")}
   ${fld("cp_entrega","CP entrega",r.cp_entrega,"f3")}${fld("localidad_entrega","Localidad entrega",r.localidad_entrega,"f3")}${fld("provincia_entrega","Provincia entrega",r.provincia_entrega,"f3")}
   ${fld("comercial","Comercial",r.comercial,"f3")}
   <div class="field f4"><label>Tipo fiscal</label><select name="tipo_fiscal">${["SL","Autónomo con RE","Canarias","Otro"].map(x=>`<option ${r.tipo_fiscal===x?"selected":""}>${x}</option>`).join("")}</select></div>
   <div class="field f4"><label>Envío habitual</label><select name="envio_habitual_id"><option value="">Sin predeterminar</option>${env.map(e=>`<option value="${e.id}" ${r.envio_habitual_id===e.id?"selected":""}>${NOC.App.esc(e.nombre)}</option>`).join("")}</select></div>
   <div class="field f12"><label>Observaciones</label><textarea name="observaciones">${NOC.App.esc(r.observaciones||"")}</textarea></div>
   </form></div><div class="modal-foot"><button class="btn" onclick="NOC.App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="NOC.Clientes.save('${id||""}')">Guardar</button></div>`)
 }
 function fld(n,l,v,c,req=false){return `<div class="field ${c}"><label>${l}</label><input name="${n}" ${req?"required":""} value="${NOC.App.esc(v||"")}"></div>`}
 async function save(id){const f=Object.fromEntries(new FormData(document.getElementById("clienteForm")));if(!f.nombre_tienda.trim())return NOC.App.toast("El nombre de tienda es obligatorio.");if(!f.envio_habitual_id)f.envio_habitual_id=null;if(id)await NOC.API.update("clientes",id,f);else await NOC.API.insert("clientes",f);NOC.App.closeModal();NOC.App.toast("Cliente guardado.");render()}
 async function del(id){if(confirm("¿Eliminar cliente?")){await NOC.API.remove("clientes",id);render()}}
 return{render,openEditor,save,del,setSort}
})();