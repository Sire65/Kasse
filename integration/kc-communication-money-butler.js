// KC Money Butler -> KC Communication integration adapter.
// Prepared inside the Kasse repository because Money Butler is part of the KC finance/cash workflow.
// No provider secrets are stored here.
export function createMoneyButlerCommunication(supabaseClient) {
  if (!supabaseClient?.functions?.invoke) throw new Error('Supabase client fehlt');
  const SOURCE='kc-money-butler';
  async function send(eventKey, recipients, variables={}, options={}) {
    const {data,error}=await supabaseClient.functions.invoke('kc-communication-router',{body:{
      sourceProgram:SOURCE,
      eventKey,
      recipients:Array.isArray(recipients)?recipients:[],
      variables:{programName:'KC Money Butler',eventName:eventKey,...variables},
      priority:options.priority||'normal',
      testOnly:options.testOnly===true,
      correlationId:options.correlationId||`money-butler-${Date.now()}`
    }});
    if(error) throw error;
    return data;
  }
  return {
    sourceProgram:SOURCE,
    send,
    test:(recipients,message='KC Money Butler Kommunikationstest')=>send('communication_test',recipients,{message},{testOnly:true}),
    warning:(recipients,message)=>send('system_warning',recipients,{message},{priority:'high'}),
    error:(recipients,message)=>send('system_error',recipients,{message},{priority:'critical'}),
    reportAvailable:(recipients,reportTitle)=>send('report_available',recipients,{reportTitle},{priority:'normal'})
  };
}
