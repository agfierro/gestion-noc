window.NOC=window.NOC||{};
NOC.Gastos=(()=>{
  const columns=[
    {key:"fecha",label:"Fecha"},
    {key:"empresa",label:"Empresa"},
    {key:"tipo_gasto",label:"Tipo de gasto"},
    {key:"numero_factura",label:"N.º factura"},
    {key:"cantidad",label:"Cantidad"},
    {key:"observaciones",label:"Observaciones"}
  ];
  let rows=[],filtered=[],sortKey="fecha",sortAsc=false,globalQuery="",filters={},renderSequence=0;
  const esc=v=>NOC.App.esc(String(v??""));
  const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es-ES").trim();
  const amountText=v=>Number(v||0).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2});
  const asNumber=v=>{let t=String(v).replace(/\s|€/g,"");if(t.includes(",")&&t.includes("."))t=t.replace(/\./g,"").replace(",",".");else if(t.includes(","))t=t.replace(",",".");return Number(t)};
  const dateText=v=>{const s=String(v||"");return /^\d{4}-\d{2}-\d{2}$/.test(s)?`${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}`:s};
  const columnValue=(r,key)=>key==="cantidad"?`${amountText(r.cantidad)} ${r.cantidad}`:key==="fecha"?`${r.fecha||""} ${dateText(r.fecha)}`:String(r[key]??"");
  const matches=(r,key,term)=>{
    if(!term)return true;
    if(key==="cantidad"){
      const t=String(term).trim();
      const value=Number(r.cantidad);
      if(/^-?[\d.,]+\s*$/.test(t)){
        const n=asNumber(t);
        if(Number.isFinite(n))return Math.abs(value-n)<0.005;
      }
    }
    return norm(columnValue(r,key)).includes(norm(term));
  };
  async function loadAll(){
    const result=[],pageSize=1000;
    for(let from=0;from<100000;from+=pageSize){
      const {data,error}=await NOC.API.db().from("gastos").select("*").order("fecha",{ascending:false}).range(from,from+pageSize-1);
      if(error)throw error;
      result.push(...(data||[]));
      if(!data||data.length<pageSize)break;
    }
    return result;
  }
  async function render(){
    const seq=++renderSequence;
    const container=document.getElementById("viewContainer");
    container.innerHTML='<div class="card"><p class="muted">Cargando gastos…</p></div>';
    try{const data=await loadAll();if(seq!==renderSequence)return;rows=data;drawShell();applyFilters();}
    catch(e){if(seq===renderSequence)container.innerHTML=`<div class="card"><p>No se han podido cargar los gastos: ${esc(e?.message||e)}</p><button class="btn" onclick="NOC.Gastos.render()">Reintentar</button></div>`;}
  }
  function drawShell(){
    const container=document.getElementById("viewContainer");
    container.innerHTML=`
      <div class="card">
        <div class="toolbar" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between">
          <div style="flex:1;min-width:230px">
            <label for="gastosSearchGlobal" style="display:block;margin-bottom:5px">Buscar en todos los campos</label>
            <input id="gastosSearchGlobal" type="search" placeholder="Empresa, factura, fecha, importe, observaciones…" style="width:100%;max-width:520px">
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
            <button class="btn" type="button" onclick="NOC.Gastos.clearFilters()">Limpiar filtros</button>
            <button class="btn btn-primary" type="button" onclick="NOC.Gastos.openEditor()">+ Nuevo gasto</button>
          </div>
        </div>
        <style>
        #gastosTabla { width:100%; min-width:1040px; table-layout:fixed; border-collapse:collapse; }
        #gastosTabla th, #gastosTabla td { box-sizing:border-box; padding:9px 7px; vertical-align:middle; overflow:hidden; }
        #gastosTabla th { white-space:nowrap; }
        #gastosTabla .gastos-sort { border:0; background:transparent; box-shadow:none; padding:3px 1px; font:inherit; font-weight:700; font-size:13px; cursor:pointer; color:inherit; max-width:100%; overflow:hidden; text-overflow:ellipsis; }
        #gastosTabla .gastos-filter { display:block; width:100%; min-width:0; max-width:100%; height:23px; padding:2px 6px; border-radius:5px; font-size:11px; box-sizing:border-box; }
        #gastosTabla .gastos-obs { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; line-clamp:2; overflow:hidden; overflow-wrap:anywhere; white-space:normal; line-height:1.4; }
        #gastosTabla .gastos-actions { white-space:nowrap; text-align:right; overflow:visible; }
        #gastosTabla .gastos-actions {display:flex;align-items:center;justify-content:center;gap:4px} #gastosTabla .gastos-icon-action{border:1px solid #d9dee7;border-radius:6px;background:#fff;color:#344054;width:26px;height:27px;padding:0;font-size:18px;line-height:1;cursor:pointer} #gastosTabla .gastos-delete{color:#b42318} #gastosTabla .gastos-icon-action:hover{background:#eef2f7}
        </style>
        <div class="table-wrap" style="max-width:100%;overflow-x:auto"><table id="gastosTabla">
          <colgroup><col style="width:105px"><col style="width:145px"><col style="width:155px"><col style="width:145px"><col style="width:115px"><col style="width:245px"><col style="width:72px"></colgroup>
          <thead>
            <tr>${columns.map(c=>`<th><button type="button" class="gastos-sort" data-gasto-sort="${c.key}" style="white-space:nowrap" title="Ordenar por ${esc(c.label)}">${esc(c.label)} <span data-sort-icon="${c.key}">↕</span></button></th>`).join("")}<th title="Acciones">Acc.</th></tr>
            <tr>${columns.map(c=>`<th><input type="search" data-gasto-filter="${c.key}" aria-label="Filtrar ${esc(c.label)}" placeholder="${c.key==="cantidad"?"Ej. -114,60":c.key==="fecha"?"AAAA-MM-DD o DD/MM/AAAA":"Filtrar…"}" class="gastos-filter"></th>`).join("")}<th></th></tr>
          </thead>
          <tbody id="gastosRows"></tbody>
        </table></div>
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;margin-top:14px">
          <span id="gastosCount" class="muted"></span>
          <strong id="gastosSum"></strong>
        </div>
      </div>`;
    container.querySelector("#gastosSearchGlobal").value=globalQuery;
    container.querySelectorAll("[data-gasto-filter]").forEach(el=>el.value=filters[el.dataset.gastoFilter]||"");
    container.querySelector("#gastosSearchGlobal").addEventListener("input",e=>{globalQuery=e.target.value;applyFilters()});
    container.querySelectorAll("[data-gasto-filter]").forEach(el=>el.addEventListener("input",e=>{filters[el.dataset.gastoFilter]=e.target.value;applyFilters()}));
    container.querySelectorAll("[data-gasto-sort]").forEach(el=>el.addEventListener("click",()=>sortBy(el.dataset.gastoSort)));
  }
  function sortBy(key){
    if(sortKey===key)sortAsc=!sortAsc;else{sortKey=key;sortAsc=true;}
    applyFilters();
  }
  function clearFilters(){
    globalQuery="";filters={};sortKey="fecha";sortAsc=false;
    const root=document.getElementById("viewContainer");
    const global=root.querySelector("#gastosSearchGlobal");if(global)global.value="";
    root.querySelectorAll("[data-gasto-filter]").forEach(el=>el.value="");
    applyFilters();
  }
  function applyFilters(){
    const terms=globalQuery.trim();
    filtered=rows.filter(r=>
      (!terms||columns.some(c=>matches(r,c.key,terms))) &&
      columns.every(c=>matches(r,c.key,filters[c.key]||""))
    );
    filtered.sort((a,b)=>{
      const x=a[sortKey],y=b[sortKey];
      let cmp=sortKey==="cantidad"?(Number(x||0)-Number(y||0)):String(x??"").localeCompare(String(y??""),"es",{numeric:true,sensitivity:"base"});
      if(cmp===0)cmp=String(a.id||"").localeCompare(String(b.id||""));
      return sortAsc?cmp:-cmp;
    });
    const tbody=document.getElementById("gastosRows");if(!tbody)return;
    tbody.innerHTML=filtered.map(r=>`<tr>
      <td>${esc(dateText(r.fecha))}</td>
      <td>${esc(r.empresa)}</td>
      <td>${esc(r.tipo_gasto)}</td>
      <td>${esc(r.numero_factura)}</td>
      <td style="text-align:right;white-space:nowrap;${Number(r.cantidad)<0?"color:#b91c1c;":""}">${esc(amountText(r.cantidad))} €</td>
      <td title="${esc(r.observaciones)}"><span class="gastos-obs">${esc(r.observaciones)}</span></td>
      <td class="gastos-actions"><button class="gastos-icon-action" title="Editar gasto" aria-label="Editar gasto" onclick="NOC.Gastos.openEditor('${esc(r.id)}')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></svg></button><button class="gastos-icon-action gastos-delete" title="Borrar gasto" aria-label="Borrar gasto" onclick="NOC.Gastos.del('${esc(r.id)}')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6M10 10v7m4-7v7"/></svg></button></td>
    </tr>`).join("")||'<tr><td colspan="7" class="empty">No hay gastos que coincidan con los filtros.</td></tr>';
    document.getElementById("gastosCount").textContent=`${filtered.length} de ${rows.length} gastos`;
    document.getElementById("gastosSum").textContent=`Total filtrado: ${amountText(filtered.reduce((sum,r)=>sum+Number(r.cantidad||0),0))} €`;
    document.querySelectorAll("[data-sort-icon]").forEach(el=>el.textContent=el.dataset.sortIcon===sortKey?(sortAsc?"↑":"↓"):"↕");
  }
async function openEditor(id){const r=id?await NOC.API.one("gastos",id):{fecha:NOC.App.today()};NOC.App.modal(`<div class="modal-head"><strong>${id?"Editar gasto":"Nuevo gasto"}</strong><button class="icon-btn" onclick="NOC.App.closeModal()">×</button></div><div class="modal-body"><form id="gastoForm" class="form-grid"><div class="field f3"><label>Fecha</label><input name="fecha" type="date" value="${r.fecha||NOC.App.today()}"></div><div class="field f5"><label>Empresa</label><input name="empresa" value="${NOC.App.esc(r.empresa||"")}"></div><div class="field f4"><label>Tipo de gasto</label><input name="tipo_gasto" value="${NOC.App.esc(r.tipo_gasto||"")}"></div><div class="field f4"><label>Cantidad</label><input name="cantidad" type="number" step="0.01" placeholder="Abonos: importe negativo" value="${Number(r.cantidad||0)}"></div><div class="field f4"><label>Nº factura</label><input name="numero_factura" value="${NOC.App.esc(r.numero_factura||"")}"></div><div class="field f12"><label>Observaciones</label><textarea name="observaciones">${NOC.App.esc(r.observaciones||"")}</textarea></div></form></div><div class="modal-foot"><button class="btn btn-primary" onclick="NOC.Gastos.save('${id||""}')">Guardar</button></div>`)}async function save(id){const f=Object.fromEntries(new FormData(document.getElementById("gastoForm")));f.cantidad=Number(f.cantidad);if(!Number.isFinite(f.cantidad))return NOC.App.alertMessage("Importe incorrecto","Introduce un importe numérico, por ejemplo -114.60.","error");try{if(id)await NOC.API.update("gastos",id,f);else await NOC.API.insert("gastos",f);NOC.App.closeModal();render()}catch(e){NOC.App.alertMessage("Error al guardar",e?.message||String(e),"error")}}async function del(id){if(confirm("¿Borrar gasto?")){await NOC.API.remove("gastos",id);render()}}return{render,openEditor,save,del,sortBy,clearFilters}})();