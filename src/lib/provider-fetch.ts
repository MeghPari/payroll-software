// Bound each provider call and the lifetime of a request-scoped client. An
// aborted write has an unknown outcome; callers must refresh before retrying.
export function providerFetch(signal?:AbortSignal):typeof fetch{
 const budget=AbortSignal.timeout(45000);
 return(input,options)=>fetch(input,{...options,signal:AbortSignal.any([budget,AbortSignal.timeout(12000),...(signal?[signal]:[]),...(options?.signal?[options.signal]:[]),...(input instanceof Request?[input.signal]:[])])});
}
