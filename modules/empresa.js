window.NOC=window.NOC||{};
NOC.Empresa=(()=>{
  async function render(){
    const {data,error}=await NOC.API.db().from("configuracion").select("*").eq("id",1).maybeSingle();
    if(error)throw error;
    const c=data||{id:1,iva_general:21,recargo_general:5.2};
    document.getElementById("viewContainer").innerHTML=`<div class="grid"><div class="card col-12">
      <h2>Datos de empresa</h2><p class="muted">Se utilizarán en las futuras plantillas de proformas y facturas.</p>
      <form id="empresaForm" class="form-grid">
        <div class="field f6"><label>Empresa / marca</label><input name="empresa" value="${e(c.empresa)}"></div>
        <div class="field f3"><label>CIF/NIF</label><input name="cif" value="${e(c.cif)}"></div>
        <div class="field f3"><label>Teléfono</label><input name="telefono" value="${e(c.telefono)}"></div>
        <div class="field f6"><label>Dirección</label><input name="direccion" value="${e(c.direccion)}"></div>
        <div class="field f2"><label>Código postal</label><input name="codigo_postal" value="${e(c.codigo_postal)}"></div>
        <div class="field f2"><label>Localidad</label><input name="localidad" value="${e(c.localidad)}"></div>
        <div class="field f2"><label>Provincia</label><input name="provincia" value="${e(c.provincia)}"></div>
        <div class="field f4"><label>Email</label><input name="email" type="email" value="${e(c.email)}"></div>
        <div class="field f4"><label>Web</label><input name="web" value="${e(c.web)}"></div>
        <div class="field f4"><label>Logo (URL, opcional)</label><input name="logo_url" value="${e(c.logo_url)}"></div>
        <div class="field f4"><label>Cuenta bancaria / CCC</label><input name="cuenta_bancaria" value="${e(c.cuenta_bancaria)}"></div>
        <div class="field f12 footer-config-title">
          <strong>Dirección del pie de proformas y facturas</strong>
          <span class="muted">Estos datos aparecen junto a la calavera en la parte inferior de los documentos.</span>
        </div>
        <div class="field f6"><label>Dirección postal del pie</label><input name="direccion_pie" value="${e(c.direccion_pie)}" placeholder="Ej.: Plaza de la Marina, 2"></div>
        <div class="field f3"><label>Código postal del pie</label><input name="cp_pie" value="${e(c.cp_pie)}" placeholder="Ej.: 29001"></div>
        <div class="field f3"><label>Localidad del pie</label><input name="localidad_pie" value="${e(c.localidad_pie)}" placeholder="Ej.: Málaga"></div>
        <div class="field f3"><label>IVA general %</label><input name="iva_general" type="number" step="0.01" value="${Number(c.iva_general??21)}"></div>
        <div class="field f3"><label>Recargo equivalencia %</label><input name="recargo_general" type="number" step="0.01" value="${Number(c.recargo_general??5.2)}"></div>
        <div class="field f12"><label>Pie de documentos</label><textarea name="pie_documentos">${e(c.pie_documentos)}</textarea></div>
      </form>
      <div class="toolbar" style="margin-top:16px"><div></div><button class="btn btn-primary" onclick="NOC.Empresa.save()">Guardar configuración</button></div>
    </div></div>`;
  }
  async function save(){
    const f=Object.fromEntries(new FormData(document.getElementById("empresaForm")));f.id=1;
    f.iva_general=Number(f.iva_general||21);f.recargo_general=Number(f.recargo_general||5.2);
    const {error}=await NOC.API.db().from("configuracion").upsert(f,{onConflict:"id"});
    if(error)throw error;NOC.App.toast("Configuración guardada.");await render();
  }
  const e=v=>NOC.App.esc(v||"");return{render,save};
})();