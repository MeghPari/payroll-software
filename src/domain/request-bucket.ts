export function requestBucket(request:Pick<Request,'method'|'url'>):'read'|'write'|'download'{
 if(!['GET','HEAD'].includes(request.method))return 'write';
 const url=new URL(request.url);
 if(url.pathname.endsWith('/pdf')||url.searchParams.get('export')==='csv'||(url.pathname==='/api/employees/documents'&&url.searchParams.has('id')))return 'download';
 return 'read';
}
