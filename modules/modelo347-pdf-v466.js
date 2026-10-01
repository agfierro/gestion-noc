window.NOC=window.NOC||{};
NOC.Modelo347PDF=(()=>{
  const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
  const safe=s=>String(s||"cliente").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,80)||"cliente";

  // IMPORTANT: anchor on the exact existing button shown in the generated report.
  function originalPrintButton(){
    const vc=document.getElementById("viewContainer"); if(!vc)return null;
    return [...vc.querySelectorAll("button,a")].find(b=>norm(b.textContent)==="imprimir / guardar pdf")||null;
  }
  function reportCard(){
    const b=originalPrintButton();
    return b?.closest(".card,.report-card,.report-section,.report-block,.panel") || b?.parentElement?.parentElement?.parentElement || null;
  }
  function clientInfo(card){
    for(const table of [...card.querySelectorAll("table")]){
      const hs=[...table.querySelectorAll("thead th")].map(x=>norm(x.textContent));
      let idx=hs.findIndex(x=>x.includes("cliente")||x.includes("punto de venta")||x.includes("razon social")||x.includes("tienda"));
      if(idx<0&&hs.length)idx=0;
      const rows=[...table.querySelectorAll("tbody tr")].filter(r=>r.cells&&r.cells.length>idx);
      const names=[...new Set(rows.map(r=>String(r.cells[idx]?.textContent||"").trim()).filter(Boolean))];
      if(names.length)return{idx,names};
    }
    return null;
  }
  function clientIndex(table){
    const hs=[...table.querySelectorAll("thead th")].map(x=>norm(x.textContent));
    const i=hs.findIndex(x=>x.includes("cliente")||x.includes("punto de venta")||x.includes("razon social")||x.includes("tienda"));
    return i<0?0:i;
  }
  function cloneFor(card,client){
    const c=card.cloneNode(true);
    c.querySelectorAll("button,.noc-347-separate").forEach(x=>x.remove());
    c.querySelectorAll("table").forEach(table=>{
      const idx=clientIndex(table), rows=[...table.querySelectorAll("tbody tr")];
      if(!rows.length)return;
      if(!rows.some(r=>String(r.cells?.[idx]?.textContent||"").trim()===client))return;
      rows.forEach(r=>{if(String(r.cells?.[idx]?.textContent||"").trim()!==client)r.remove();});
    });
    c.querySelectorAll("[id]").forEach(x=>x.removeAttribute("id"));
    c.style.cssText+=";background:#fff;color:#111;padding:18px;width:100%";
    return c;
  }
  async function separate(){
    const card=reportCard(), info=card&&clientInfo(card);
    if(!card||!info?.names?.length){NOC.App.toast("No he podido identificar los clientes del Modelo 347.");return;}
    if(typeof html2pdf!=="function"){NOC.App.toast("No está disponible el generador PDF.");return;}
    NOC.App.toast(`Preparando ${info.names.length} PDF del Modelo 347…`);
    for(const client of info.names){
      const clone=cloneFor(card,client), host=document.createElement("div");
      host.style.cssText="position:fixed;left:-100000px;top:0;width:1120px;background:#fff;z-index:-1";
      host.appendChild(clone); document.body.appendChild(host);
      try{
        await html2pdf().set({
          margin:[8,8,8,8],filename:`Modelo_347_${safe(client)}.pdf`,
          image:{type:"jpeg",quality:.98},
          html2canvas:{scale:1.7,useCORS:true,backgroundColor:"#fff"},
          jsPDF:{unit:"mm",format:"a4",orientation:"landscape"},
          pagebreak:{mode:["css","legacy"],avoid:["tr"]}
        }).from(clone).save();
      }finally{host.remove();}
      await new Promise(r=>setTimeout(r,250));
    }
    NOC.App.toast(`${info.names.length} PDF generados. Si Chrome lo solicita, permite descargas múltiples.`);
  }
  function install(){
    const old=originalPrintButton();
    if(!old)return;
    if(document.querySelector(".noc-347-separate"))return;

    // Existing working button is retained; only its label changes.
    old.textContent="Imprimir completo";

    const sep=document.createElement("button");
    sep.type="button";
    sep.className=old.className||"btn";
    sep.classList.add("noc-347-separate");
    sep.textContent="Imprimir separado por clientes";
    sep.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();separate();});
    old.insertAdjacentElement("afterend",sep);
  }

  // The 347 report is created dynamically after clicking "Generar informe 347".
  const obs=new MutationObserver(()=>requestAnimationFrame(install));
  function start(){
    const vc=document.getElementById("viewContainer");
    if(vc)obs.observe(vc,{childList:true,subtree:true});
    install();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start); else start();
  return{separate,install};
})();