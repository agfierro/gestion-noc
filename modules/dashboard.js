window.NOC=window.NOC||{};
NOC.Dashboard=(()=>{
 async function render(){
   const [pf,fac,g,cl]=await Promise.all([
     NOC.API.list("proformas",{select:"total,estado"}),
     NOC.API.list("facturas",{select:"total"}),
     NOC.API.list("gastos",{select:"cantidad"}),
     NOC.API.list("clientes",{select:"id"})
   ]);
   const p=pf.filter(x=>x.estado!=="Cancelada").reduce((a,b)=>a+Number(b.total||0),0);
   const f=fac.reduce((a,b)=>a+Number(b.total||0),0);
   const gg=g.reduce((a,b)=>a+Number(b.cantidad||0),0);
   document.getElementById("viewContainer").innerHTML=`<div class="grid">
    <div class="card col-3"><div class="muted">Proformado</div><div class="metric">${NOC.App.money(p)}</div></div>
    <div class="card col-3"><div class="muted">Facturado</div><div class="metric">${NOC.App.money(f)}</div></div>
    <div class="card col-3"><div class="muted">Gastos</div><div class="metric">${NOC.App.money(gg)}</div></div>
    <div class="card col-3"><div class="muted">Clientes</div><div class="metric">${cl.length}</div></div>
    <div class="card col-12"><h2>Acciones rápidas</h2><div class="toolbar-left">
      <button class="btn btn-primary" onclick="NOC.App.openNewProforma()">Nueva proforma</button>
      <button class="btn" onclick="NOC.App.show('clientes')">Clientes</button>
      <button class="btn" onclick="NOC.App.show('articulos')">Artículos</button>
    </div></div></div>`;
 }
 return{render}
})();