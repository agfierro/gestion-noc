window.NOC=window.NOC||{};
(()=>{
  function csvEscape(v){const s=String(v??"");return /[;"\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
  function download(name,text){const b=new Blob(["\uFEFF"+text],{type:"text/csv;charset=utf-8"}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),500)}
  async function exportGestoria(){
    try{
      const {data,error}=await NOC.API.db().from("facturas").select("numero,fecha_operacion,fecha_expedicion,cliente_id,forma_pago,base_imponible,iva,recargo,total,observaciones").order("fecha_expedicion",{ascending:true});
      if(error)throw error;
      const h=["numero","fecha_operacion","fecha_expedicion","cliente_id","forma_pago","base_imponible","iva","recargo","total","observaciones"];
      download(`facturas_gestoria_${new Date().toISOString().slice(0,10)}.csv`,h.join(";")+"\r\n"+(data||[]).map(r=>h.map(k=>csvEscape(r[k])).join(";")).join("\r\n"));
      NOC.App.toast("Exportación para gestoría preparada con ambas fechas.");
    }catch(e){NOC.App.toast("No se pudo exportar: "+e.message)}
  }
  NOC.V57={exportGestoria};
  if(NOC.Herramientas?.render){
    const old=NOC.Herramientas.render;
    NOC.Herramientas.render=async function(){
      await old();
      const tbody=document.getElementById("toolsTableBody");
      if(tbody){
        [...tbody.querySelectorAll("tr")].forEach(tr=>{
          const t=(tr.cells?.[0]?.innerText||"").toLowerCase();
          let note="";
          if((t.includes("proformas")&&!t.includes("líneas"))||(t.includes("facturas")&&!t.includes("líneas")))note=" (primero proformas/facturas)";
          if(t.includes("líneas de proforma")||t.includes("lineas_proforma")||t.includes("líneas de factura")||t.includes("lineas_factura"))note=" (segundo líneas proformas/facturas)";
          if(note&&tr.cells?.[0]){
            const s=document.createElement("span");s.textContent=note;s.style.cssText="color:#a8adb3;font-size:12px;font-weight:400;margin-left:5px";tr.cells[0].querySelector("strong")?.appendChild(s);
          }
        });
        const card=tbody.closest(".card");
        if(card){
          const box=document.createElement("div");box.style.cssText="margin-top:14px;padding-top:14px;border-top:1px solid #eceff1";
          box.innerHTML='<button class="btn btn-small" onclick="NOC.V57.exportGestoria()">Exportar facturas para gestoría · 2 fechas</button><span style="color:#a8adb3;font-size:12px;margin-left:10px">Incluye fecha de operación y fecha de expedición</span>';
          card.appendChild(box);
        }
      }
    }
  }
})();