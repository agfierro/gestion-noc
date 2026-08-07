window.NOC=window.NOC||{};
NOC.Facturas=(()=>{async function render(){const {data,error}=await NOC.API.db().from("facturas").select("*, clientes(nombre_tienda)").order("created_at",{ascending:false});if(error)throw error;document.getElementById("viewContainer").innerHTML=`<div class="card"><div class="table-wrap"><table><thead><tr><th>Nº</th><th>Fecha</th><th>Cliente</th><th>Pago</th><th>Total</th><th>Acciones</th></tr></thead><tbody>${data.map(r=>`<tr><td><strong>${r.numero}</strong></td><td>${r.fecha}</td><td>${NOC.App.esc(r.clientes?.nombre_tienda||"")}</td><td>${NOC.App.esc(r.forma_pago||"")}</td><td>${NOC.App.money(r.total)}</td><td><button class="btn btn-small" onclick="NOC.Facturas.ver('${r.id}')">Ver factura</button></td></tr>`).join("")||`<tr><td colspan="6" class="empty">No hay facturas.</td></tr>`}</tbody></table></div></div>`}async function ver(id){
  const {data:f,error}=await NOC.API.db().from("facturas").select("*, clientes(*)").eq("id",id).single();
  if(error)throw error;
  const {data:ls,error:e2}=await NOC.API.db().from("lineas_factura").select("*").eq("factura_id",id).order("orden");
  if(e2)throw e2;
  const config=await NOC.Documentos.getConfig();
  const html=NOC.Documentos.render({tipo:"FACTURA",doc:f,lineas:ls||[],config});
  NOC.App.modal(`<div class="modal-head"><strong>Factura ${NOC.App.esc(f.numero)}</strong><button class="icon-btn" onclick="NOC.App.closeModal()">×</button></div><div class="modal-body">${html}</div><div class="modal-foot"><button class="btn" onclick="window.print()">Imprimir / Guardar PDF</button></div>`,false,"document-modal");
}
return{render,ver}})();