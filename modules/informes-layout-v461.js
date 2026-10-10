window.NOC=window.NOC||{};
(()=>{
  const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
  let busy=false;

  function heading(text){
    const target=norm(text);
    return [...document.querySelectorAll("#viewContainer h1,#viewContainer h2,#viewContainer h3,#viewContainer h4")]
      .find(el=>norm(el.textContent).includes(target)) || null;
  }
  function blockFor(h){
    if(!h)return null;
    return h.closest(".card,.report-card,.report-section,.report-block,.dashboard-card,.panel")
      || h.parentElement;
  }
  function isInformes(){
    const t=document.getElementById("pageTitle");
    return t && norm(t.textContent)==="informes";
  }

  function apply(){
    if(busy || !isInformes())return;
    busy=true;
    try{
      // DETALLE POR MES: moverlo justo encima de "Lo más destacado del periodo".
      const detailH=heading("detalle por mes");
      const highH=heading("lo mas destacado del periodo") || heading("lo mas destacado");
      const detail=blockFor(detailH), highlights=blockFor(highH);
      if(detail && highlights && detail!==highlights && highlights.parentElement){
        highlights.parentElement.insertBefore(detail,highlights);
      }

      // EVOLUCIÓN MENSUAL: ocultar la tarjeta y dejar un botón en su lugar.
      const graphH=heading("evolucion mensual");
      const graph=blockFor(graphH);
      if(graph && !graph.dataset.nocV61Graph){
        graph.dataset.nocV61Graph="1";
        graph.style.display="none";

        const holder=document.createElement("div");
        holder.className="noc-v61-graph-toggle";
        holder.dataset.nocV61Toggle="1";

        const btn=document.createElement("button");
        btn.type="button";
        btn.className="btn btn-small";
        btn.textContent="Mostrar gráfico";
        btn.addEventListener("click",()=>{
          const hidden=graph.style.display==="none";
          graph.style.display=hidden?"":"none";
          btn.textContent=hidden?"Ocultar gráfico":"Mostrar gráfico";
        });
        holder.appendChild(btn);
        graph.parentElement.insertBefore(holder,graph);
      }
    } finally {
      busy=false;
    }
  }

  // Se ejecuta aunque Informes vuelva a pintar el HTML después de cargar datos/filtros.
  const obs=new MutationObserver(()=>requestAnimationFrame(apply));
  const start=()=>{
    const vc=document.getElementById("viewContainer");
    if(vc)obs.observe(vc,{childList:true,subtree:true});
    apply();
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);
  else start();
})();