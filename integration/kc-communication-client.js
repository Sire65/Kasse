// KC Marktkasse -> KC Communication integration adapter.
// This file intentionally contains no secrets. Pass the application's authenticated Supabase client.
export function createKcCommunication(supabaseClient) {
  if (!supabaseClient?.functions?.invoke) throw new Error('Supabase client fehlt');
  const SOURCE='kc-kasse';
  return {
    async send(eventKey, recipients, variables={}, options={}) {
      const {data,error}=await supabaseClient.functions.invoke('kc-communication-router',{body:{sourceProgram:SOURCE,eventKey,recipients:Array.isArray(recipients)?recipients:[],variables,priority:options.priority||'normal',testOnly:options.testOnly===true,correlationId:options.correlationId||`kasse-${Date.now()}`}});
      if(error) throw error; return data;
    }
  };
}
