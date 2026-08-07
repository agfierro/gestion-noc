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
    empresa:["Empresa","Datos fiscales y documentos",()=>NOC.Empresa.render()],
    configuracion:["Tipos de envío","Tarifas y opciones de transporte",()=>NOC.Configuracion.render()],
    herramientas:["Herramientas","Importar, exportar y copias",()=>NOC.Herramientas.render()]
  };
  async function init(){
    try{NOC.API.init();setConnection(true)}
    catch(e){console.error(e);setConnection(false,e.message);return}
    document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>show(b.dataset.view)));
    document.getElementById("menuBtn").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
    await NOC.Auth.init();
    if(NOC.Auth.isAuthenticated())await startAuthenticated();
  }

  async function startAuthenticated(){
    if(!NOC.Auth.isAuthenticated())return;
    try{await NOC.API.list("clientes",{limit:1});setConnection(true);await show("dashboard")}
    catch(e){console.error(e);setConnection(false,e.message);toast("Sesión iniciada, pero no se puede acceder a los datos.")}
  }

  function stopAuthenticated(){
    document.getElementById("viewContainer").innerHTML="";
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.remove("active"));
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
  function modal(html,small=false,extraClass=""){document.getElementById("modalRoot").innerHTML=`<div class="modal-backdrop" onclick="if(event.target===this)NOC.App.closeModal()"><div class="modal ${small?"small":""} ${extraClass||""}">${html}</div></div>`}
  function closeModal(){document.getElementById("modalRoot").innerHTML=""}
  function money(v){return new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(Number(v||0))}
  function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
  function today(){return new Date().toISOString().slice(0,10)}
  function openNewProforma(){show("proformas").then(()=>NOC.Proformas.openEditor())}

  function showProgress(message="Procesando…",detail=""){
    let root=document.getElementById("progressRoot");
    if(!root){
      root=document.createElement("div");
      root.id="progressRoot";
      document.body.appendChild(root);
    }
    root.innerHTML=`<div class="progress-backdrop">
      <div class="progress-card" role="status" aria-live="polite">
        <div class="progress-spinner"></div>
        <div class="progress-title">${esc(message)}</div>
        ${detail?`<div class="progress-detail">${esc(detail)}</div>`:""}
      </div>
    </div>`;
  }

  function updateProgress(message,detail=""){
    const root=document.getElementById("progressRoot");
    if(!root||!root.innerHTML)return showProgress(message,detail);
    const t=root.querySelector(".progress-title"),d=root.querySelector(".progress-detail");
    if(t)t.textContent=message||"Procesando…";
    if(d)d.textContent=detail||"";
    else if(detail){
      const el=document.createElement("div");el.className="progress-detail";el.textContent=detail;
      root.querySelector(".progress-card")?.appendChild(el);
    }
  }

  function hideProgress(){
    const root=document.getElementById("progressRoot");
    if(root)root.innerHTML="";
  }

  function alertMessage(title,message,type="info"){
    modal(`<div class="modal-head"><strong>${esc(title)}</strong><button class="icon-btn" onclick="NOC.App.closeModal()">×</button></div>
      <div class="modal-body">
        <div class="app-message ${type}">
          <div class="app-message-icon">${type==="success"?"✓":type==="error"?"!":"i"}</div>
          <div>${esc(message)}</div>
        </div>
      </div>
      <div class="modal-foot"><button class="btn btn-primary" onclick="NOC.App.closeModal()">Aceptar</button></div>`,true);
  }
  return{init,show,toast,modal,closeModal,money,esc,today,openNewProforma,showProgress,updateProgress,hideProgress,alertMessage,startAuthenticated,stopAuthenticated};
})();
window.addEventListener("DOMContentLoaded",NOC.App.init);
