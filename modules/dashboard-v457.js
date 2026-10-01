window.NOC=window.NOC||{};
NOC.Dashboard=(()=>{
  const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  let year=new Date().getFullYear(), period="year", cache=null;

  const esc=s=>NOC.App.esc(s), money=n=>NOC.App.money(Number(n||0));
  async function all(table,select="*"){
    const out=[]; let from=0; const size=1000;
    while(true){
      const {data,error}=await NOC.API.db().from(table).select(select).range(from,from+size-1);
      if(error)throw error;
      out.push(...(data||[]));
      if(!data||data.length<size)break;
      from+=size;
    }
    return out;
  }
  function fdate(r){ return String(r.fecha_operacion||r.fecha||""); }
  function isWeb(r){ return String(r.forma_pago||"").toLowerCase()==="web" || /^WEB/i.test(String(r.numero||"")) || /^DEV-WEB/i.test(String(r.numero||"")); }
  function monthsForPeriod(){
    if(period==="t1")return[0,1,2]; if(period==="t2")return[3,4,5];
    if(period==="t3")return[6,7,8]; if(period==="t4")return[9,10,11];
    return [...Array(12).keys()];
  }
  function calc(y){
    const months=Array.from({length:12},()=>({total:0,pv:0,web:0,uds:0,proformas:0}));
    for(const r of cache.facturas){
      const d=fdate(r); if(!d.startsWith(String(y)))continue;
      const m=Number(d.slice(5,7))-1;if(m<0||m>11)continue;
      const v=Number(r.total||0); months[m].total+=v; months[m][isWeb(r)?"web":"pv"]+=v;
    }
    const pfById=new Map();
    for(const p of cache.proformas){
      const d=String(p.fecha||""); if(!d.startsWith(String(y)))continue;
      const m=Number(d.slice(5,7))-1;if(m<0||m>11)continue;
      pfById.set(String(p.id),m); months[m].proformas++;
    }
    for(const l of cache.lineas){
      if(l.es_envio)continue;
      const m=pfById.get(String(l.proforma_id)); if(m===undefined)continue;
      months[m].uds+=Number(l.cantidad||0);
    }
    return months;
  }
  function sums(months, idxs){
    return idxs.reduce((a,i)=>{for(const k of ["total","pv","web","uds","proformas"])a[k]+=months[i][k];return a},{total:0,pv:0,web:0,uds:0,proformas:0});
  }
  function pct(cur,prev){ if(!prev)return cur?"+100 %":"—"; const p=(cur-prev)/Math.abs(prev)*100; return `${p>=0?"+":""}${p.toLocaleString("es-ES",{maximumFractionDigits:1})} %`; }
  function periodLabel(){return period==="year"?"Año completo":period.toUpperCase();}
  function tableFor(y,months,idxs,title){
    const s=sums(months,idxs);
    const th=idxs.map(i=>`<th>${MESES[i]}</th>`).join("");
    const row=(label,key,fmt)=>`<tr><th>${label}</th>${idxs.map(i=>`<td>${fmt(months[i][key])}</td>`).join("")}<td class="dash-total">${fmt(s[key])}</td></tr>`;
    return `<div class="dash-table-card"><h3>${title}</h3><div class="dash-scroll"><table class="dash-month-table"><thead><tr><th></th>${th}<th>Total</th></tr></thead><tbody>
      ${row("Total","total",money)}${row("Puntos de venta","pv",money)}${row("Web","web",money)}
      ${row("Artículos proformados","uds",v=>Number(v).toLocaleString("es-ES"))}
    </tbody></table></div></div>`;
  }
  function miniBars(months,idxs){
    const max=Math.max(1,...idxs.map(i=>months[i].total));
    return `<div class="dash-chart">${idxs.map(i=>`<div class="dash-bar-col"><div class="dash-bar-value">${money(months[i].total)}</div><div class="dash-bar-wrap"><div class="dash-bar" style="height:${Math.max(3,months[i].total/max*150)}px"></div></div><span>${MESES[i].slice(0,3)}</span></div>`).join("")}</div>`;
  }
  async function render(){
    document.getElementById("viewContainer").innerHTML='<div class="card">Cargando dashboard…</div>';
    const [facturas,proformas,lineas]=await Promise.all([
      all("facturas","id,numero,fecha,fecha_operacion,fecha_expedicion,forma_pago,total,proforma_id"),
      all("proformas","id,fecha,estado,total"),
      all("lineas_proforma","proforma_id,cantidad,es_envio")
    ]);
    cache={facturas,proformas,lineas};
    const years=[...new Set([...facturas.map(x=>Number(fdate(x).slice(0,4))),...proformas.map(x=>Number(String(x.fecha||"").slice(0,4))),new Date().getFullYear()].filter(Number.isFinite))].sort((a,b)=>b-a);
    if(!years.includes(year))year=years[0]||new Date().getFullYear();
    paint(years);
  }
  function paint(years){
    const idxs=monthsForPeriod(), cur=calc(year), prev=calc(year-1), s=sums(cur,idxs), ps=sums(prev,idxs);
    const pvShare=s.total?100*s.pv/s.total:0, webShare=s.total?100*s.web/s.total:0;
    const yopts=years.map(y=>`<option value="${y}" ${y===year?"selected":""}>${y}</option>`).join("");
    document.getElementById("viewContainer").innerHTML=`<div class="noc-dashboard57">
      <div class="dash-head">
        <div><div class="modern-kicker">VISIÓN DE NEGOCIO</div><h1>Dashboard ${year}</h1><p>Facturación, canal web, puntos de venta y actividad comercial mes a mes.</p></div>
        <div class="dash-filters">
          <label>Año<select onchange="NOC.Dashboard.setYear(this.value)">${yopts}</select></label>
          <label>Periodo<select onchange="NOC.Dashboard.setPeriod(this.value)">
            <option value="year" ${period==="year"?"selected":""}>Año completo</option>
            <option value="t1" ${period==="t1"?"selected":""}>T1 · Ene–Mar</option>
            <option value="t2" ${period==="t2"?"selected":""}>T2 · Abr–Jun</option>
            <option value="t3" ${period==="t3"?"selected":""}>T3 · Jul–Sep</option>
            <option value="t4" ${period==="t4"?"selected":""}>T4 · Oct–Dic</option>
          </select></label>
        </div>
      </div>
      <div class="dash-kpis">
        <div class="dash-kpi"><small>Facturación · ${periodLabel()}</small><strong>${money(s.total)}</strong><span>${pct(s.total,ps.total)} vs ${year-1}</span></div>
        <div class="dash-kpi"><small>Puntos de venta</small><strong>${money(s.pv)}</strong><span>${pvShare.toLocaleString("es-ES",{maximumFractionDigits:1})} % del total</span></div>
        <div class="dash-kpi"><small>Web</small><strong>${money(s.web)}</strong><span>${webShare.toLocaleString("es-ES",{maximumFractionDigits:1})} % del total</span></div>
        <div class="dash-kpi"><small>Artículos proformados</small><strong>${s.uds.toLocaleString("es-ES")}</strong><span>${pct(s.uds,ps.uds)} vs ${year-1}</span></div>
      </div>
      <div class="dash-table-card"><div class="dash-card-title"><div><h3>Evolución mensual · ${periodLabel()}</h3><p>El detalle mensual se mantiene siempre visible.</p></div></div>${miniBars(cur,idxs)}</div>
      ${tableFor(year,cur,idxs,`Facturación por meses ${year}`)}
      <div class="dash-section-title"><h2>Comparativa histórica</h2><p>Mismo periodo y mismos meses para comparar correctamente.</p></div>
      ${tableFor(year-1,prev,idxs,`Facturación por meses ${year-1}`)}
      ${tableFor(year-2,calc(year-2),idxs,`Facturación por meses ${year-2}`)}
    </div>`;
  }
  function setYear(v){year=Number(v);paint([...new Set([year,year-1,year-2])]);}
  function setPeriod(v){period=v;paint([...new Set([year,year-1,year-2])]);}
  return{render,setYear,setPeriod};
})();