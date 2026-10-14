export class RequestError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}, companyId?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('content-type', 'application/json');
  if (companyId) headers.set('x-company-id', companyId);
  const response = await fetch(`/api/${path}`, { ...options, headers, credentials: 'same-origin', cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) {
    const fields=payload.error?.fields as {path:string;message:string}[]|undefined;
    const detail=payload.error?.code==='VALIDATION_ERROR'&&Array.isArray(fields)?fields.slice(0,3).map(field=>`${field.path||'Submitted data'}: ${field.message}`).join(' '):'';
    throw new RequestError(response.status, payload.error?.code ?? 'REQUEST_FAILED', detail||payload.error?.message||'The request failed.');
  }
  return payload.data as T;
}
