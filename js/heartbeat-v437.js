window.NOC=window.NOC||{};
NOC.Heartbeat=(()=>{
  let lastRun=0;
  async function ping(){
    const now=Date.now();
    if(now-lastRun<60000)return;
    lastRun=now;
    try{
      const db=NOC.API.db();
      const {data:{session}}=await db.auth.getSession();
      if(!session)return;
      // Lectura mínima real contra la BBDD. No crea ni modifica datos.
      const {error}=await db.from("clientes").select("id").limit(1);
      if(error)throw error;
      try{localStorage.setItem("noc_last_supabase_activity",new Date().toISOString())}catch(_){}
    }catch(e){
      console.warn("NOC heartbeat: no se pudo realizar la consulta de actividad",e?.message||e);
    }
  }
  function init(){
    setTimeout(ping,1200);
    try{
      NOC.API.db().auth.onAuthStateChange((event,session)=>{
        if(session&&(event==="SIGNED_IN"||event==="TOKEN_REFRESHED"||event==="INITIAL_SESSION"))setTimeout(ping,350);
      });
    }catch(e){}
  }
  window.addEventListener("DOMContentLoaded",init);
  return{ping};
})();