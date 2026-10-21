import 'server-only';
import { z, ZodError } from 'zod';
import { getEnv } from './env';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter?:number) { super(message); }
}
export function databaseError(error: { code?: string; message: string } | null) {
  if (!error) return;
  if(error.code===''||['PGRST000','PGRST001','PGRST002','PGRST003'].includes(error.code??''))throw new ApiError(503,'DATABASE_UNAVAILABLE','The database request could not be confirmed. Refresh the records before retrying.');
  if (['PGRST202','PGRST204','PGRST205','42703','42P01','42883'].includes(error.code ?? '')) throw new ApiError(503,'MIGRATION_REQUIRED','The database needs the latest application migration. Contact your administrator.');
  if (error.code === '42501') throw new ApiError(403, 'FORBIDDEN', 'Permission denied.');
  if(error.code==='P0049')throw new ApiError(422,'EMPLOYEE_MASTER_REQUIRED',error.message);
  if (error.code === 'P0048') throw new ApiError(422, 'DEPARTMENT_MISMATCH', 'The selected designation belongs to a different department. Choose its department or Other / Custom.');
  if (error.code === 'P0002') throw new ApiError(404, 'NOT_FOUND', 'Record not found.');
  if (['23505', '40001', '55P03'].includes(error.code ?? '')) throw new ApiError(409, 'CONFLICT', 'Duplicate record or concurrent change. Refresh and retry.');
  if (['23503', '23514', '22023', '22007', '22P02'].includes(error.code ?? '')) throw new ApiError(422, 'INVALID_DATA', 'Data failed database validation.');
  // Log a code only: DB errors can embed sensitive input in message/details.
  console.error('Database operation failed', { code: error.code });
  throw new ApiError(500, 'DATABASE_ERROR', 'The database operation failed.');
}
export function result<T>(data: T, status = 200) {
  return Response.json({ data }, { status, headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' } });
}
export function endpoint(fn: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try {
      if (!['GET','HEAD','OPTIONS'].includes(request.method)) {
        const origin = request.headers.get('origin');
        if (origin !== new URL(getEnv().APP_URL).origin) throw new ApiError(403,'INVALID_ORIGIN','Request origin is not allowed.');
      }
      return await fn(request);
    } catch (error) {
      if (error instanceof ZodError) return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Check the submitted fields.', fields: error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) } }, { status: 422, headers: { 'Cache-Control':'no-store' } });
      if (error instanceof SyntaxError) return Response.json({ error: { code:'INVALID_JSON', message:'Invalid JSON body.' } }, { status:400 });
      const known = error instanceof ApiError;
      const missing = error instanceof Error && error.message === 'BACKEND_NOT_CONFIGURED';
      if (!known && !missing) console.error('Unhandled API error', { type: error instanceof Error ? error.name : 'unknown' });
      return Response.json({ error: { code: known ? error.code : missing ? 'BACKEND_NOT_CONFIGURED' : 'INTERNAL_ERROR', message: known ? error.message : missing ? 'Configure the Supabase project before using PayFlow.' : 'The request could not be completed.' } }, { status: known ? error.status : missing ? 503 : 500, headers: { 'Cache-Control':'no-store',...(known&&error.status===429?{'Retry-After':String(error.retryAfter??60)}:{}) } });
    }
  };
}
export async function body<T extends z.ZodTypeAny>(request: Request, schema: T,maxBytes=128_000): Promise<z.infer<T>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(415,'CONTENT_TYPE','Use application/json.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400,'INVALID_JSON','JSON body is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new ApiError(413,'BODY_TOO_LARGE','Request body is too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const raw = new TextDecoder().decode(bytes);
  return schema.parse(JSON.parse(raw));
}
