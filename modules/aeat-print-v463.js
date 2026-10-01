window.NOC=window.NOC||{};
NOC.AEATPrint=(()=>{
  const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
  const safe=s=>String(s||"cliente").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,80)||"cliente";

  function isAeat(){
    const vc=document.getElementById("viewContainer");
    if(!vc)return false;
    const t=norm(vc.innerText);
    return t.includes("agencia tributaria") && (t.includes("3.005,06")||t.includes("3005,06")||t.includes("3005.06")||t.includes("3.000"));
  }
  function root(){
    const vc=document.getElementById("viewContainer");
    if(!vc)return null;
    const h=[...vc.querySelectorAll("h1,h2,h3,h4,strong")].find(x=>norm(x.textContent).includes("agencia tributaria"));
    return h?.closest(".card,.report-card,.report-section,.report-block,.panel")||vc;
  }
  function originalPrintButton(){
    const r=root(); if(!r)return null;
    return [...r.querySelectorAll("button,a")].find(b=>{
      const t=norm(b.textContent);
      return (t.includes("imprimir")||t.includes("guardar pdf")||t==="pdf") && !t.includes("separado") && !t.includes("csv");
    })||null;
  }
  function clientInfo(r){
    for(const table of [...r.querySelectorAll("table")]){
      const hs=[...table.querySelectorAll("thead th")].map(x=>norm(x.textContent));
      let idx=hs.findIndex(x=>x.includes("cliente")||x.includes("razon social")||x.includes("tienda"));
      if(idx<0&&hs.length)idx=0;
      const rows=[...table.querySelectorAll("tbody tr")].filter(x=>x.cells&&x.cells.length>idx);
      const names=[...new Set(rows.map(x=>String(x.cells[idx]?.textContent||"").trim()).filter(Boolean))];
      if(names.length)return{idx,names};
    }
    return null;
  }
  function clientIndex(table){
    const hs=[...table.querySelectorAll("thead th")].map(x=>norm(x.textContent));
    const i=hs.findIndex(x=>x.includes("cliente")||x.includes("razon social")||x.includes("tienda"));
    return i<0?0:i;
  }
  function cloneFor(r,client){
    const c=r.cloneNode(true);
    c.querySelectorAll("button,.noc-v63-print-buttons,.noc-v61-graph-toggle,.noc-v60-graph-toggle").forEach(x=>x.remove());
    c.querySelectorAll("table").forEach(table=>{
      const idx=clientIndex(table),rows=[...table.querySelectorAll("tbody tr")];
      if(!rows.some(x=>String(x.cells?.[idx]?.textContent||"").trim()===client))return;
      rows.forEach(x=>{if(String(x.cells?.[idx]?.textContent||"").trim()!==client)x.remove();});
    });
    c.querySelectorAll("[id]").forEach(x=>x.removeAttribute("id"));
    c.style.cssText+=";background:#fff;color:#111;padding:18px;width:100%";
    return c;
  }
  async function separate(){
    const r=root(),info=clientInfo(r);
    if(!r||!info?.names?.length){NOC.App.toast("No he podido identificar los clientes del informe.");return;}
    if(typeof html2pdf!=="function"){NOC.App.toast("No está disponible el generador PDF.");return;}
    NOC.App.toast(`Preparando ${info.names.length} PDF por cliente…`);
    for(const client of info.names){
      const c=cloneFor(r,client),host=document.createElement("div");
      host.style.cssText="position:fixed;left:-100000px;top:0;width:1120px;background:#fff;z-index:-1";
      host.appendChild(c);document.body.appendChild(host);
      try{
        await html2pdf().set({margin:[8,8,8,8],filename:`AEAT_${safe(client)}.pdf`,image:{type:"jpeg",quality:.98},html2canvas:{scale:1.7,useCORS:true,backgroundColor:"#fff"},jsPDF:{unit:"mm",format:"a4",orientation:"landscape"},pagebreak:{mode:["css","legacy"],avoid:["tr"]}}).from(c).save();
      }finally{host.remove();}
      await new Promise(res=>setTimeout(res,250));
    }
    NOC.App.toast(`${info.names.length} PDF generados. Si Chrome lo solicita, permite descargas múltiples.`);
  }
  function install(){
    if(!isAeat())return;
    const old=originalPrintButton();
    if(!old||document.querySelector(".noc-v63-print-buttons"))return;

    // Rename existing working button: it remains the complete report.
    old.textContent="Imprimir completo";

    const wrap=document.createElement("span");
    wrap.className="noc-v63-print-buttons";
    const sep=document.createElement("button");
    sep.type="button";
    sep.className=old.className||"btn";
    sep.textContent="Imprimir separado por clientes";
    sep.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();separate();});
    wrap.appendChild(sep);
    old.insertAdjacentElement("afterend",wrap);
  }

  const obs=new MutationObserver(()=>requestAnimationFrame(install));
  const start=()=>{const vc=document.getElementById("viewContainer");if(vc)obs.observe(vc,{childList:true,subtree:true});install();};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start); else start();
  return{separate};
})();