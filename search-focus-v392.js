/*
 NOC V3.9.2 - Conserva el foco/cursor cuando un módulo reconstruye la vista
 mientras el usuario está escribiendo. Funciona para los buscadores actuales
 de Clientes, Artículos, Proformas, Facturas y futuros campos con id/name.
*/
(function(){
  let last=null;
  document.addEventListener("input",function(ev){
    const el=ev.target;
    if(!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement))return;
    const type=(el.type||"text").toLowerCase();
    if(!["text","search","email","tel","url","number"].includes(type) && !(el instanceof HTMLTextAreaElement))return;
    last={
      id:el.id||"",
      name:el.name||"",
      value:el.value,
      start:typeof el.selectionStart==="number"?el.selectionStart:null,
      end:typeof el.selectionEnd==="number"?el.selectionEnd:null
    };
    requestAnimationFrame(function(){
      if(!last)return;
      let target=null;
      if(last.id)target=document.getElementById(last.id);
      if(!target && last.name){
        try{target=document.querySelector(`[name="${CSS.escape(last.name)}"]`)}catch(_){}
      }
      if(!target || target===document.activeElement)return;
      // Only restore if the value matches what the user just typed, so we do not
      // steal focus during unrelated navigation/modals.
      if(String(target.value)!==String(last.value))return;
      try{
        target.focus({preventScroll:true});
        if(last.start!==null && typeof target.setSelectionRange==="function"){
          target.setSelectionRange(last.start,last.end);
        }
      }catch(_){}
    });
  },true);
})();