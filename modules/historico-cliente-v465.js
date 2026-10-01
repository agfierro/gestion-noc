window.NOC=window.NOC||{};
NOC.HistoricoCliente=(()=>{
  const fields=["nombre","apellidos","nombre_tienda","telefono","email","dni_cif","direccion_facturacion","cp_facturacion","localidad_facturacion","provincia_facturacion","direccion_entrega","cp_entrega","localidad_entrega","provincia_entrega","tipo_fiscal"];
  function frozen(doc){
    if(!doc)return doc;
    const c={...(doc.clientes||{})};
    let has=false;
    fields.forEach(k=>{
      const key="cliente_"+k;
      if(doc[key]!==undefined && doc[key]!==null){c[k]=doc[key];has=true;}
    });
    return has?{...doc,clientes:c}:doc;
  }
  function install(){
    if(!NOC.Documentos||typeof NOC.Documentos.render!=="function"||NOC.Documentos.render.__nocFrozen)return;
    const old=NOC.Documentos.render;
    const wrapped=function(args){
      if(args&&args.doc)args={...args,doc:frozen(args.doc)};
      return old.call(this,args);
    };
    wrapped.__nocFrozen=true;
    NOC.Documentos.render=wrapped;
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install);else install();
  setTimeout(install,0);
  return{frozen,install};
})();