window.NOC=window.NOC||{};
NOC.Modelo347PDF=(()=>{
  const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
  const safe=s=>String(s||"cliente").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,80)||"cliente";

  function reportCard(){
    const vc=document.getElementById("viewContainer"); if(!vc)return null;
    const hs=[...vc.querySelectorAll("h1,h2,h3,h4")];
    const h=hs.find(x=>norm(x.textContent).includes("informe modelo 347"));
    return h?.closest(".card,.report-card,.report-section,.report-block,.panel") || h?.parentElement?.parentElement || null;
  }
  function printBtn(card){
    return [...card.querySelectorAll("button,a")].find(b=>norm(b.textContent).includes("imprimir / guardar pdf")) || null;
  }
  function tableInfo(card){
    for(const table of [...card.querySelectorAll("table")]){
      const heads=[...table.querySelectorAll("thead th")].map(x=>norm(x.textContent));
      let idx=heads.findIndex(x=>x.includes("cliente")||x.includes("punto de venta")||x.includes("razon social")||x.includes("tienda"));
      if(idx<0 && heads.length) idx=0;
      const rows=[...table.querySelectorAll("tbody tr")].filter(r=>r.cells&&r.cells.length>idx);
      const names=[...new Set(rows.map(r=>String(r.cells[idx]?.textContent||"").trim()).filter(Boolean))];
      if(names.length)return {idx,names};
    }
    return null;
  }
  function clientIndex(table){
    const heads=[...table.querySelectorAll("thead th")].map(x=>norm(x.textContent));
    const i=heads.findIndex(x=>x.includes("cliente")||x.includes("punto de venta")||x.includes("razon social")||x.includes("tienda"));
    return i<0?0:i;
  }
  function cloneFor(card,client){
    const c=card.cloneNode(true);
    c.querySelectorAll("button,.noc-347-buttons").forEach(x=>x.remove());
    c.querySelectorAll("table").forEach(table=>{
      const idx=clientIndex(table), rows=[...table.querySelectorAll("tbody tr")];
      if(!rows.some(r=>String(r.cells?.[idx]?.textContent||"").trim()===client))return;
      rows.forEach(r=>{if(String(r.cells?.[idx]?.textContent||"").trim()!==client)r.remove();});
    });
    c.querySelectorAll("[id]").forEach(x=>x.removeAttribute("id"));
    c.style.cssText+=";background:#fff;color:#111;padding:18px;width:100%";
    return c;
  }
  async function separate(){
    const card=reportCard(), info=card&&tableInfo(card);
    if(!card||!info?.names?.length){NOC.App.toast("No he podido identificar los clientes del Modelo 347.");return;}
    if(typeof html2pdf!=="function"){NOC.App.toast("No está disponible el generador PDF.");return;}
    NOC.App.toast(`Preparando ${info.names.length} PDF del Modelo 347…`);
    for(const client of info.names){
      const clone=cloneFor(card,client), host=document.createElement("div");
      host.style.cssText="position:fixed;left:-100000px;top:0;width:1120px;background:#fff;z-index:-1";
      host.appendChild(clone);document.body.appendChild(host);
      try{
        await html2pdf().set({
          margin:[8,8,8,8], filename:`Modelo_347_${safe(client)}.pdf`,
          image:{type:"jpeg",quality:.98},
          html2canvas:{scale:1.7,useCORS:true,backgroundColor:"#fff"},
          jsPDF:{unit:"mm",format:"a4",orientation:"landscape"},
          pagebreak:{mode:["css","legacy"],avoid:["tr"]}
        }).from(clone).save();
      } finally {host.remove();}
      await new Promise(r=>setTimeout(r,250));
    }
    NOC.App.toast(`${info.names.length} PDF generados. Si Chrome lo solicita, permite descargas múltiples.`);
  }
  function install(){
    const card=reportCard(); if(!card)return;
    const old=printBtn(card); if(!old || card.querySelector(".noc-347-buttons"))return;

    // Preserve the exact, already-working complete-print action.
    old.textContent="Imprimir completo";

    const sep=document.createElement("button");
    sep.type="button";
    sep.className=old.className||"btn";
    sep.textContent="Imprimir separado por clientes";
    sep.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();separate();});

    const holder=document.createElement("span");
    holder.className="noc-347-buttons";
    holder.appendChild(sep);
    old.insertAdjacentElement("afterend",holder);
  }

  const obs=new MutationObserver(()=>requestAnimationFrame(install));
  function start(){
    const vc=document.getElementById("viewContainer");
    if(vc)obs.observe(vc,{childList:true,subtree:true});
    install();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start); else start();
  return {separate};
})();