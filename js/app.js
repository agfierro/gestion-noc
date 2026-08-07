window.NOC=window.NOC||{};
NOC.App=(()=>{
  const views={
    dashboard:["Inicio","Resumen general",()=>NOC.Dashboard.render()],
    clientes:["Clientes","Tiendas y datos fiscales",()=>NOC.Clientes.render()],
    articulos:["Artículos","Catálogo, costes y márgenes",()=>NOC.Articulos.render()],
    proformas:["Proformas","Preparación y seguimiento",()=>NOC.Proformas.render()],
    facturas:["Facturas","Documentos facturados",()=>NOC.Facturas.render()],
    gastos:["Gastos","Registro y control",()=>NOC.Gastos.render()],
    informes:["Informes","Análisis de ventas y gastos",()=>NOC.Informes.render()],
    configuracion:["Tipos de envío","Tarifas y opciones de transporte",()=>NOC.Configuracion.render()],
    herramientas:["Herramientas","Importar, exportar y copias",()=>NOC.Herramientas.render()]
  };
  async function init(){
    try{NOC.API.init();await NOC.API.list("clientes",{limit:1});setConnection(true)}
    catch(e){console.error(e);setConnection(false,e.message)}
    document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>show(b.dataset.view)));
    document.getElementById("menuBtn").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
    show("dashboard");
  }
  async function show(name){
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
    const v=views[name];if(!v)return;
    document.getElementById("pageTitle").textContent=v[0];document.getElementById("pageSubtitle").textContent=v[1];
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("viewContainer").innerHTML='<div class="card">Cargando…</div>';
    try{await v[2]()}catch(e){console.error(e);document.getElementById("viewContainer").innerHTML=`<div class="card"><h3>Error</h3><p class="muted">${esc(e.message)}</p></div>`}
  }
  function setConnection(ok,msg){const d=document.getElementById("connectionDot"),t=document.getElementById("connectionText");d.className="status-dot "+(ok?"ok":"error");t.textContent=ok?"Supabase conectado":"Sin conexión"+(msg?": "+msg:"")}
  function toast(msg){document.getElementById("toastRoot").innerHTML=`<div class="toast">${esc(msg)}</div>`;setTimeout(()=>document.getElementById("toastRoot").innerHTML="",2800)}
  function modal(html,small=false){document.getElementById("modalRoot").innerHTML=`<div class="modal-backdrop" onclick="if(event.target===this)NOC.App.closeModal()"><div class="modal ${small?"small":""}">${html}</div></div>`}
  function closeModal(){document.getElementById("modalRoot").innerHTML=""}
  function money(v){return new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(Number(v||0))}
  function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
  function today(){return new Date().toISOString().slice(0,10)}
  function openNewProforma(){show("proformas").then(()=>NOC.Proformas.openEditor())}
  return{init,show,toast,modal,closeModal,money,esc,today,openNewProforma};
})();
window.addEventListener("DOMContentLoaded",NOC.App.init);
