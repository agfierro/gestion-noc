window.NOC=window.NOC||{};
(()=>{
  const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();

  function headingBlock(text){
    const target=norm(text);
    const heads=[...document.querySelectorAll("#viewContainer h1,#viewContainer h2,#viewContainer h3,#viewContainer h4,#viewContainer .card-title,#viewContainer .section-title")];
    const h=heads.find(x=>norm(x.textContent).includes(target));
    if(!h)return null;
    return h.closest(".card,.report-section,.report-block,.section") || h.parentElement;
  }

  function improveReports(){
    // 1) Detalle por mes: inmediatamente antes de "Lo más destacado del periodo".
    const detail=headingBlock("detalle por mes");
    const highlights=headingBlock("lo mas destacado del periodo") || headingBlock("lo mas destacado");
    if(detail && highlights && detail!==highlights && highlights.parentElement){
      highlights.parentElement.insertBefore(detail,highlights);
    }

    // 2) Gráfico oculto de inicio y accesible mediante botón.
    // Buscamos primero por encabezado y después por elementos gráficos habituales.
    let graph=headingBlock("grafico") || headingBlock("evolucion");
    if(!graph){
      const el=document.querySelector('#viewContainer canvas,#viewContainer .report-bars,#viewContainer [id*="graf" i],#viewContainer [class*="chart" i]');
      if(el) graph=el.closest(".card,.report-section,.report-block") || el;
    }
    if(graph && !graph.dataset.nocV60Graph){
      graph.dataset.nocV60Graph="1";
      graph.style.display="none";
      const wrap=document.createElement("div");
      wrap.className="noc-v60-graph-toggle";
      const btn=document.createElement("button");
      btn.className="btn btn-small";
      btn.type="button";
      btn.textContent="Mostrar gráfico";
      btn.onclick=()=>{
        const open=graph.style.display==="none";
        graph.style.display=open?"":"none";
        btn.textContent=open?"Ocultar gráfico":"Mostrar gráfico";
      };
      wrap.appendChild(btn);
      graph.parentElement?.insertBefore(wrap,graph);
    }
  }

  function install(){
    if(!NOC.Dashboard || typeof NOC.Dashboard.renderReport!=="function")return;
    if(NOC.Dashboard.renderReport.__nocV60)return;
    const original=NOC.Dashboard.renderReport;
    const wrapped=async function(...args){
      const r=await original.apply(this,args);
      requestAnimationFrame(()=>requestAnimationFrame(improveReports));
      return r;
    };
    wrapped.__nocV60=true;
    NOC.Dashboard.renderReport=wrapped;
  }

  // dashboard-v460.js ya ha preservado renderReport del módulo original.
  install();
})();