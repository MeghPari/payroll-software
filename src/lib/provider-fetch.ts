// Bound each provider call and the lifetime of a request-scoped client. An
// aborted write has an unknown outcome; callers must refresh before retrying.
export function providerFetch(signal?:AbortSignal):typeof fetch{
 const budget=AbortSignal.timeout(45000);
 return async(input,options)=>{
  const bounded=AbortSignal.any([budget,AbortSignal.timeout(12000),...(signal?[signal]:[]),...(options?.signal?[options.signal]:[]),...(input instanceof Request?[input.signal]:[])]);
  try{return await fetch(input,{...options,signal:bounded});}
  catch(error){
   // Do not log URLs, headers, bodies or messages: they can contain credentials.
   const failure=error as {name?:string;cause?:{code?:string}};
   console.error('Provider transport failed',{name:failure.name,code:failure.cause?.code,requestAborted:signal?.aborted??false,boundedAborted:bounded.aborted});
   throw error;
  }
 };
}
