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
  function clientUnits(card){
    const all=[...card.querySelectorAll("*")];
    // Modelo 347 renders each customer as a repeated visual block. Detect the smallest
    // repeated containers that contain a customer heading/name and monetary detail.
    const candidates=all.filter(el=>{
      if(!el.children?.length)return false;
      const t=norm(el.innerText);
      if(!t || t.length<15)return false;
      const money=/\d[\d.,]*\s*€/.test(el.innerText);
      const invoice=/f20\d{2}-|factura|trimestre|1º|2º|3º|4º|t1|t2|t3|t4/i.test(el.innerText);
      return money && invoice;
    });
    // Prefer direct children of a common parent: those are normally the per-client cards.
    const groups=new Map();
    for(const el of candidates){
      const par=el.parentElement;if(!par)continue;
      const arr=groups.get(par)||[];arr.push(el);groups.set(par,arr);
    }
    let units=[];
    for(const arr of groups.values()) if(arr.length>units.length) units=arr;
    // Remove nested duplicates, retaining the smallest useful repeated unit.
    units=units.filter((u,i,a)=>!a.some((v,j)=>j!==i && u.contains(v)));
    return units;
  }
  function nameFromUnit(unit,i){
    const heads=[...unit.querySelectorAll("h2,h3,h4,strong,b")];
    for(const h of heads){
      const t=String(h.textContent||"").trim();
      const n=norm(t);
      if(t && !n.includes("factura") && !n.includes("trimestre") && !n.includes("total") && !/^\d/.test(t)) return t;
    }
    // Fallback: first meaningful line of the client block.
    const lines=String(unit.innerText||"").split(/\n+/).map(x=>x.trim()).filter(Boolean);
    return lines.find(x=>!norm(x).includes("factura")&&!norm(x).includes("trimestre")&&!/^[\d.,\s€]+$/.test(x)) || `Cliente_${i+1}`;
  }
  function clientInfo(card){
    // First support table-shaped reports if present.
    for(const table of [...card.querySelectorAll("table")]){
      const hs=[...table.querySelectorAll("thead th")].map(x=>norm(x.textContent));
      let idx=hs.findIndex(x=>x.includes("cliente")||x.includes("punto de venta")||x.includes("razon social")||x.includes("tienda"));
      if(idx<0&&hs.length)idx=0;
      const rows=[...table.querySelectorAll("tbody tr")].filter(r=>r.cells&&r.cells.length>idx);
      const names=[...new Set(rows.map(r=>String(r.cells[idx]?.textContent||"").trim()).filter(Boolean))];
      if(names.length)return{mode:"table",idx,names};
    }
    const units=clientUnits(card);
    if(units.length)return{mode:"blocks",units,names:units.map(nameFromUnit)};
    return null;
  }
  function clientIndex(table){
    const hs=[...table.querySelectorAll("thead th")].map(x=>norm(x.textContent));
    const i=hs.findIndex(x=>x.includes("cliente")||x.includes("punto de venta")||x.includes("razon social")||x.includes("tienda"));
    return i<0?0:i;
  }
  function cloneFor(card,client,info,index){
    const c=card.cloneNode(true);
    c.querySelectorAll("button,.noc-347-separate").forEach(x=>x.remove());

    if(info.mode==="table"){
      c.querySelectorAll("table").forEach(table=>{
        const idx=clientIndex(table), rows=[...table.querySelectorAll("tbody tr")];
        if(!rows.length)return;
        if(!rows.some(r=>String(r.cells?.[idx]?.textContent||"").trim()===client))return;
        rows.forEach(r=>{if(String(r.cells?.[idx]?.textContent||"").trim()!==client)r.remove();});
      });
    } else {
      // Find the same repeated client units in the clone and keep only the requested one.
      const cloneUnits=clientUnits(c);
      cloneUnits.forEach((u,i)=>{if(i!==index)u.remove();});
    }

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
      const clone=cloneFor(card,client,info,info.names.indexOf(client)), host=document.createElement("div");
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