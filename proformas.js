window.NOC=window.NOC||{};
NOC.Proformas=(()=>{
 let selectedIds=new Set();
 async function render(){
   const {data,error}=await NOC.API.db().from("proformas").select("*, clientes(nombre_tienda)").order("created_at",{ascending:false});if(error)throw error;
   document.getElementById("viewContainer").innerHTML=`<div class="card"><div class="toolbar"><div class="toolbar-left"><button class="btn btn-primary" onclick="NOC.Proformas.openEditor()">+ Nueva proforma</button><button class="btn" onclick="NOC.Proformas.openBulkStatus()">Cambiar estado seleccionadas</button><button class="btn" onclick="NOC.Proformas.facturarSeleccionadas()">Facturar seleccionadas</button></div></div>
   <div class="table-wrap"><table><thead><tr><th></th><th>Nº</th><th>Fecha</th><th>Cliente</th><th>Estado</th><th>Total</th><th>Pago</th><th>Acciones</th></tr></thead><tbody>
   ${data.map(r=>`<tr><td><input type="checkbox" ${selectedIds.has(r.id)?"checked":""} onchange="NOC.Proformas.toggle('${r.id}',this.checked)"></td><td><strong>${NOC.App.esc(r.numero)}</strong></td><td>${r.fecha}</td><td>${NOC.App.esc(r.clientes?.nombre_tienda||"")}</td><td><span class="badge ${String(r.estado).toLowerCase()}">${r.estado}</span></td><td>${NOC.App.money(r.total)}</td><td>${NOC.App.esc(r.forma_pago||"Transferencia")}</td><td class="actions"><button class="btn btn-small" onclick="NOC.Proformas.ver('${r.id}')">Ver Proforma</button>${r.estado==="Enviada"?`<button class="btn btn-small" onclick="NOC.Proformas.openEditor('${r.id}')">Editar</button><button class="btn btn-small" onclick="NOC.Proformas.openStatus('${r.id}')">Estado</button><button class="btn btn-small btn-primary" onclick="NOC.Proformas.facturar('${r.id}')">Facturar</button>`:(r.estado==="Cancelada"?`<button class="btn btn-small" onclick="NOC.Proformas.openStatus('${r.id}')">Estado</button>`:"")}</td></tr>`).join("")||`<tr><td colspan="8" class="empty">No hay proformas.</td></tr>`}
   </tbody></table></div></div>`
 }
 async function openEditor(id){
   if(id){
     const estadoActual=await NOC.API.one("proformas",id,"id,estado");
     if(estadoActual.estado==="Cancelada"){
       NOC.App.toast("Una proforma cancelada no se puede modificar.");
       return;
     }
     if(estadoActual.estado==="Facturada"){
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
 function drawLines(){const box=document.getElementById("lineEditor");if(!box)return;box.innerHTML=window._pfLines.map(l=>`<div class="line-editor"><div class="field wide"><label>Artículo</label><input class="art-input" data-key="${l._key}" value="${NOC.App.esc(l.descripcion||"")}" placeholder="Escribe para buscar…"><div class="search-holder"></div></div><div class="field"><label>Cantidad</label><input type="number" min="1" value="${Number(l.cantidad||1)}" onchange="NOC.Proformas.patchLine('${l._key}','cantidad',this.value)"></div><div class="field"><label>Dto. %</label><input type="number" min="0" max="100" value="${Number(l.descuento||0)}" onchange="NOC.Proformas.patchLine('${l._key}','descuento',this.value)"></div><div class="field"><label>Tallaje</label><input value="${NOC.App.esc(l.tallaje||"")}" onchange="NOC.Proformas.patchLine('${l._key}','tallaje',this.value)"></div><button class="btn btn-danger" onclick="NOC.Proformas.removeLine('${l._key}')">×</button></div>`).join("");box.querySelectorAll(".art-input").forEach(i=>{i.addEventListener("input",()=>searchFor(i));i.addEventListener("focus",()=>searchFor(i))})}
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
  const form=Object.fromEntries(new FormData(document.getElementById("pfForm")));if(!form.cliente_id)return NOC.App.toast("Selecciona un cliente.");const lines=(window._pfLines||[]).filter(x=>x.articulo_id);if(!lines.length)return NOC.App.toast("Añade al menos un artículo.");
  const cli=await NOC.API.one("clientes",form.cliente_id),tax=taxFor(cli);form.envio_precio=Number(form.envio_precio||0);form.envio_descuento=Number(form.envio_descuento||0);if(!form.envio_id)form.envio_id=null;
  let base=lines.reduce((s,l)=>s+Number(l.precio_unitario||0)*Number(l.cantidad||0)*(1-Number(l.descuento||0)/100),0);base+=form.envio_precio*(1-form.envio_descuento/100);const iva=base*tax.iva,re=base*tax.re,total=base+iva+re;Object.assign(form,{base_imponible:base,iva,recargo:re,total});
  let pf;if(id){pf=await NOC.API.update("proformas",id,form);await NOC.API.db().from("lineas_proforma").delete().eq("proforma_id",id)}else{const numero=await NOC.API.rpc("siguiente_numero_proforma");pf=await NOC.API.insert("proformas",{...form,numero,estado:"Enviada"})}
  const payload=lines.map((l,i)=>({proforma_id:pf.id,articulo_id:l.articulo_id,descripcion:l.descripcion,precio_unitario:Number(l.precio_unitario||0),cantidad:Number(l.cantidad||1),descuento:Number(l.descuento||0),tallaje:l.tallaje||"",orden:i+1,es_envio:false}));
  let env="Gastos de envío";if(form.envio_id){try{env=(await NOC.API.one("tipos_envio",form.envio_id)).nombre}catch{}}
  payload.push({proforma_id:pf.id,articulo_id:null,descripcion:env,precio_unitario:form.envio_precio,cantidad:1,descuento:form.envio_descuento,tallaje:"",orden:9999,es_envio:true});const {error}=await NOC.API.db().from("lineas_proforma").insert(payload);if(error)throw error;
  NOC.App.closeModal();NOC.App.toast("Proforma guardada.");render()
 }
 function toggle(id,on){on?selectedIds.add(id):selectedIds.delete(id)}
 function openStatus(id){NOC.App.modal(`<div class="modal-head"><strong>Cambiar estado</strong><button class="icon-btn" onclick="NOC.App.closeModal()">×</button></div><div class="modal-body"><select id="statusSelect"><option>Enviada</option><option>Cancelada</option><option>Facturada</option></select></div><div class="modal-foot"><button class="btn btn-primary" onclick="NOC.Proformas.setStatus('${id}',document.getElementById('statusSelect').value)">Aplicar</button></div>`,true)}
 function openBulkStatus(){if(!selectedIds.size)return NOC.App.toast("Selecciona proformas.");NOC.App.modal(`<div class="modal-head"><strong>Cambiar estado (${selectedIds.size})</strong><button class="icon-btn" onclick="NOC.App.closeModal()">×</button></div><div class="modal-body"><select id="bulkStatus"><option>Enviada</option><option>Cancelada</option><option>Facturada</option></select></div><div class="modal-foot"><button class="btn btn-primary" onclick="NOC.Proformas.applyBulkStatus()">Aplicar</button></div>`,true)}
 async function setStatus(id,s){await NOC.API.update("proformas",id,{estado:s});NOC.App.closeModal();render()}
 async function applyBulkStatus(){const s=document.getElementById("bulkStatus").value;for(const id of selectedIds)await NOC.API.update("proformas",id,{estado:s});selectedIds.clear();NOC.App.closeModal();render()}
 async function facturar(id){
  const p=await NOC.API.one("proformas",id);
  if(p.estado==="Cancelada"){
    NOC.App.toast("Una proforma cancelada no se puede facturar.");
    return false;
  }
  if(p.estado==="Facturada"){
    NOC.App.toast("Esta proforma ya está facturada.");
    return false;
  }
  if(p.estado!=="Enviada"){
    NOC.App.toast("Solo se pueden facturar proformas en estado Enviada.");
    return false;
  }const {data:ls,error}=await NOC.API.db().from("lineas_proforma").select("*").eq("proforma_id",id).order("orden");if(error)throw error;const numero=await NOC.API.rpc("siguiente_numero_factura");const f=await NOC.API.insert("facturas",{numero,fecha:NOC.App.today(),cliente_id:p.cliente_id,proforma_id:id,forma_pago:p.forma_pago,base_imponible:p.base_imponible,iva:p.iva,recargo:p.recargo,total:p.total,observaciones:p.observaciones});const {error:e2}=await NOC.API.db().from("lineas_factura").insert(ls.map(l=>({factura_id:f.id,articulo_id:l.articulo_id,descripcion:l.descripcion,precio_unitario:l.precio_unitario,cantidad:l.cantidad,descuento:l.descuento,tallaje:l.tallaje,orden:l.orden,es_envio:l.es_envio})));if(e2)throw e2;await NOC.API.update("proformas",id,{estado:"Facturada"});NOC.App.toast("Factura creada.");await render();return true}
 async function facturarSeleccionadas(){
  if(!selectedIds.size)return NOC.App.toast("Selecciona proformas.");
  let facturadas=0,bloqueadas=0;
  for(const id of [...selectedIds]){
    const p=await NOC.API.one("proformas",id,"id,estado");
    if(p.estado!=="Enviada"){bloqueadas++;continue;}
    const ok=await facturar(id);
    if(ok)facturadas++;
  }
  selectedIds.clear();
  if(bloqueadas)NOC.App.toast(`${facturadas} facturada(s). ${bloqueadas} omitida(s) por no estar Enviada.`);
  await render();
}
 async function ver(id){
  const {data:p,error}=await NOC.API.db().from("proformas").select("*, clientes(*)").eq("id",id).single();
  if(error)throw error;
  const {data:ls,error:e2}=await NOC.API.db().from("lineas_proforma").select("*").eq("proforma_id",id).order("orden");
  if(e2)throw e2;
  const config=await NOC.Documentos.getConfig();
  const html=NOC.Documentos.render({tipo:"PROFORMA",doc:p,lineas:ls||[],config});
  NOC.App.modal(`<div class="modal-head"><strong>Proforma ${NOC.App.esc(p.numero)}</strong><button class="icon-btn" onclick="NOC.App.closeModal()">×</button></div><div class="modal-body">${html}</div><div class="modal-foot"><button class="btn" onclick="window.print()">Imprimir / Guardar PDF</button></div>`,false,"document-modal");
}
 return{render,openEditor,addLine,removeLine,patchLine,save,toggle,openStatus,openBulkStatus,setStatus,applyBulkStatus,facturar,facturarSeleccionadas,ver}
})();