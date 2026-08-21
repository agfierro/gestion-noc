window.NOC=window.NOC||{};
NOC.Auth=(()=>{
  let session=null,initialized=false;

  async function init(){
    if(initialized)return session;
    initialized=true;
    const form=document.getElementById("loginForm");
    if(form)form.addEventListener("submit",async e=>{e.preventDefault();await signIn();});

    const {data,error}=await NOC.API.db().auth.getSession();
    if(error)console.error(error);
    session=data?.session||null;
    applySession(session);

    NOC.API.db().auth.onAuthStateChange((event,newSession)=>{
      const wasAuthenticated=!!session;
      session=newSession||null;
      applySession(session);

      // Supabase puede emitir SIGNED_IN de nuevo al recuperar una pestaña,
      // refrescar el token o volver desde otra app. No debemos reconstruir
      // toda la vista si el usuario ya estaba autenticado, porque eso borra
      // informes y estado de pantalla.
      if(event==="SIGNED_IN"&&session&&!wasAuthenticated)NOC.App.startAuthenticated();
      if(event==="SIGNED_OUT")NOC.App.stopAuthenticated();
    });
    return session;
  }

  async function signIn(){
    const email=document.getElementById("loginEmail")?.value.trim();
    const password=document.getElementById("loginPassword")?.value||"";
    const btn=document.getElementById("loginButton"),errBox=document.getElementById("loginError");
    if(errBox)errBox.textContent="";
    if(!email||!password)return;
    if(btn){btn.disabled=true;btn.textContent="Entrando…";}
    const {data,error}=await NOC.API.db().auth.signInWithPassword({email,password});
    if(btn){btn.disabled=false;btn.textContent="Entrar";}
    if(error){if(errBox)errBox.textContent="Email o contraseña incorrectos.";return;}
    session=data.session;applySession(session);await NOC.App.startAuthenticated();
  }

  async function signOut(){await NOC.API.db().auth.signOut();}

  function applySession(s){
    const gate=document.getElementById("authGate"),shell=document.getElementById("appShell"),
      user=document.getElementById("sessionUser"),logout=document.getElementById("logoutBtn");
    if(s){
      if(gate)gate.style.display="none";if(shell)shell.style.display="flex";
      if(user){user.textContent=s.user?.email||"Usuario";user.classList.add("session-user");}
      if(logout)logout.style.display="";
    }else{
      if(gate)gate.style.display="grid";if(shell)shell.style.display="none";
      if(user)user.textContent="";if(logout)logout.style.display="none";
      const pwd=document.getElementById("loginPassword");if(pwd)pwd.value="";
    }
  }
  function getSession(){return session} function isAuthenticated(){return !!session}
  return{init,signIn,signOut,getSession,isAuthenticated};
})();