window.NOC=window.NOC||{};
NOC.API=(()=>{
  let client;
  function init(){
    const c=window.APP_CONFIG||{};
    if(!c.SUPABASE_URL||!c.SUPABASE_ANON_KEY)throw new Error("Falta configurar Supabase.");
    client=supabase.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY);
    return client;
  }
  function db(){if(!client)init();return client}
  async function list(table,opts={}){
    let q=db().from(table).select(opts.select||"*");
    if(opts.eq)Object.entries(opts.eq).forEach(([k,v])=>q=q.eq(k,v));
    if(opts.order)q=q.order(opts.order,{ascending:opts.ascending??false});
    if(opts.limit)q=q.limit(opts.limit);
    const {data,error}=await q;if(error)throw error;return data||[];
  }
  async function one(table,id,select="*"){const {data,error}=await db().from(table).select(select).eq("id",id).single();if(error)throw error;return data}
  async function insert(table,row){const {data,error}=await db().from(table).insert(row).select().single();if(error)throw error;return data}
  async function update(table,id,row){const {data,error}=await db().from(table).update(row).eq("id",id).select().single();if(error)throw error;return data}
  async function remove(table,id){const {error}=await db().from(table).delete().eq("id",id);if(error)throw error}
  async function rpc(fn,params={}){const {data,error}=await db().rpc(fn,params);if(error)throw error;return data}
  return{init,db,list,one,insert,update,remove,rpc};
})();
