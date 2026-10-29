"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {Users,Wallet,FileText,Mail,MoreHorizontal,RefreshCw} from 'lucide-react';
import {useAppStore,payrollMonths} from '@/store/app-store';
import {useSessionStore} from '@/store/session-store';
import {permitted} from '@/lib/tenant-api';
import {PageHeader} from '@/components/shared/page-header';
import {StatCard} from '@/components/shared/stat-card';
import {SectionCard} from '@/components/shared/section-card';
import {SearchInput} from '@/components/shared/search-input';
import {FilterSelect} from '@/components/shared/filter-select';
import {StatusBadge} from '@/components/shared/status-badge';
import {DataTable,type Column} from '@/components/shared/data-table';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from '@/components/ui/dropdown-menu';
import {ConfirmDialog} from '@/components/shared/confirm-dialog';
import {getPayslipDashboard,managePayslips,emailPayslips,getPayslipHistory,payslipFile,savePayslipFile} from '@/services/payslip.service';
import {payslipEmailMessage,type PayslipDashboard,type PayslipModuleRow} from '@/domain/payslips-module';
import {formatINR} from '@/utils/format';
import {toast} from 'sonner';

type Job={action:'generate'|'regenerate'|'publish'|'email';rows:PayslipModuleRow[]};
const dateLabel=(date:string|null)=>date?new Date(date).toLocaleString('en-IN'):'Not recorded';
export default function PayslipsPage(){const company=useSessionStore(s=>s.companyId),month=useAppStore(s=>s.month),setMonth=useAppStore(s=>s.setMonth);return <PayslipPeriod key={`${company}/${month}`} month={month} setMonth={setMonth}/>;}
function PayslipPeriod({month,setMonth}:{month:string;setMonth:(month:string)=>void}){
 const [data,setData]=useState<PayslipDashboard|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const [search,setSearch]=useState(''),[department,setDepartment]=useState('All'),[status,setStatus]=useState('All'),[emailStatus,setEmailStatus]=useState('All');
 const [selected,setSelected]=useState(new Set<string>()),[job,setJob]=useState<Job|null>(null);
 const [preview,setPreview]=useState<{url:string;name:string}|null>(null),[history,setHistory]=useState<{name:string;emails:Awaited<ReturnType<typeof getPayslipHistory>>['emails'];revisions:Awaited<ReturnType<typeof getPayslipHistory>>['revisions']}|null>(null);
 const active=useRef(true);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview.url);},[preview]);
 const load=useCallback(async(signal?:AbortSignal)=>{try{const next=await getPayslipDashboard(month,signal);if(active.current){setData(next);setError('');}}catch(e){if(!signal?.aborted&&active.current)setError(e instanceof Error?e.message:'Unable to load payslips.');}finally{if(active.current)setLoading(false);}},[month]);
 useEffect(()=>{
  const controller=new AbortController();
  // load only updates state after its awaited network request.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  void load(controller.signal);
  return()=>controller.abort();
 },[load]);
 const rows=useMemo(()=>data?.items??[],[data]);
 const filtered=useMemo(()=>rows.filter(row=>(!search||`${row.employeeName} ${row.employeeCode}`.toLowerCase().includes(search.toLowerCase()))&&(department==='All'||row.department===department)&&(status==='All'||row.status===status)&&(emailStatus==='All'||row.emailStatus===emailStatus)),[rows,search,department,status,emailStatus]);
 const targets=filtered.filter(row=>selected.has(row.employeeId));
 const canGenerate=permitted('payroll.run')&&!!data?.canManage,canPublish=permitted('payroll.approve')&&!!data?.canManage;
 const candidates=(action:Job['action'],source=targets)=>source.filter(row=>action==='generate'?row.canGenerate&&row.status==='Not generated':action==='regenerate'?row.canGenerate&&row.status==='Generated':action==='publish'?row.status==='Generated':row.status==='Published'&&row.email.includes('@')&&['Not sent','Failed'].includes(row.emailStatus));
 function requestJob(action:Job['action'],source=targets){const eligible=candidates(action,source);if(!eligible.length){toast.info('No eligible employees selected for this action.');return;}if(eligible.length>100){toast.info('Select up to 100 employees at a time.');return;}setJob({action,rows:eligible});}
 async function runJob(){if(!job)return;setBusy(job.action);try{
  if(job.action==='email'){
   let sent=0,other=0;for(let start=0;start<job.rows.length&&active.current;start+=5){const chunk=job.rows.slice(start,start+5);const response=await emailPayslips(chunk.map(row=>row.payslipId!),crypto.randomUUID());for(const result of response.results)if(result.status==='Sent')sent++;else other++;}
   toast.info(`${sent} emails accepted by the provider${other?`; ${other} need review in email history`:''}.`);
  }else{const response=await managePayslips(month,job.action,job.rows.map(row=>job.action==='publish'?row.payslipId!:row.employeeId));toast.success(`${response.count} payslips ${job.action==='publish'?'published':job.action==='regenerate'?'regenerated':'generated'}.`);}
  if(active.current){setSelected(new Set());await load();}
 }catch(e){toast.error(e instanceof Error?e.message:'Payslip action failed.');if(active.current)await load();}finally{if(active.current){setBusy('');setJob(null);}}}
 async function pdf(row:PayslipModuleRow,show=false){if(!row.payslipId)return;setBusy('pdf');try{const blob=await payslipFile(`pdf?id=${row.payslipId}`);if(!active.current)return;if(show)setPreview({url:URL.createObjectURL(blob),name:row.employeeName});else savePayslipFile(blob,`payslip-${row.employeeCode}-${month}.pdf`);}catch(e){toast.error(e instanceof Error?e.message:'Unable to open PDF.');}finally{if(active.current)setBusy('');}}
 async function zip(){const ids=targets.flatMap(row=>row.payslipId?[row.payslipId]:[]);if(!ids.length||ids.length>25){toast.info('Select between 1 and 25 generated payslips for a ZIP download.');return;}setBusy('zip');try{const blob=await payslipFile('zip',ids);if(active.current)savePayslipFile(blob,`payslips-${month}.zip`);}catch(e){toast.error(e instanceof Error?e.message:'ZIP download failed.');}finally{if(active.current)setBusy('');}}
 async function showHistory(row:PayslipModuleRow){setBusy('history');try{const details=await getPayslipHistory(row.payslipId!);if(active.current)setHistory({name:row.employeeName,...details});}catch(e){toast.error(e instanceof Error?e.message:'Unable to load history.');}finally{if(active.current)setBusy('');}}
 const columns:Column<PayslipModuleRow>[]=[
  {accessorKey:'employeeName',header:'Employee',cell:({row:{original:r}})=><div className="min-w-40"><p className="font-medium">{r.employeeName}</p><p className="text-xs text-muted-foreground">{r.employeeCode}</p></div>},
  {accessorKey:'department',header:'Department',cell:({row})=>row.original.department||'Not provided'},
  {accessorKey:'grossMinor',header:'Gross salary',cell:({row})=>row.original.grossMinor===null?'Not calculated':formatINR(row.original.grossMinor/100)},
  {accessorKey:'netMinor',header:'Net salary',cell:({row})=>row.original.netMinor===null?'Not calculated':formatINR(row.original.netMinor/100)},
  {accessorKey:'status',header:'Payslip',cell:({row:{original:r}})=><div className="max-w-56 space-y-1"><StatusBadge status={r.status}/>{r.reason&&!r.payslipId&&<p className="text-xs text-muted-foreground">{r.reason}</p>}{r.batchNumber&&<p className="text-xs text-muted-foreground">Batch {r.batchNumber} / {r.runStatus}</p>}</div>},
  {accessorKey:'emailStatus',header:'Email',cell:({row:{original:r}})=><div className="max-w-52 space-y-1"><StatusBadge status={r.emailStatus} tone={r.emailStatus==='Sent'?'success':['Failed','Unconfirmed'].includes(r.emailStatus)?'warning':'neutral'}/>{r.emailStatus==='Sent'&&<p className="text-xs text-muted-foreground">Accepted by provider</p>}{r.emailError&&<p className="text-xs text-muted-foreground">{payslipEmailMessage[r.emailError]??'Review email history.'}</p>}{data?.canManage&&!r.email&&<p className="text-xs text-muted-foreground">Work email missing</p>}</div>},
  {id:'actions',header:'Actions',enableSorting:false,cell:({row:{original:r}})=><div className="flex gap-1">
   {r.payslipId&&<Button size="sm" variant="ghost" disabled={!!busy} onClick={()=>void pdf(r,true)}>Preview</Button>}
   <DropdownMenu><DropdownMenuTrigger disabled={!!busy} render={<Button size="icon-sm" variant="outline" aria-label={`Payslip actions for ${r.employeeName}`}/>}><MoreHorizontal className="h-4 w-4"/></DropdownMenuTrigger><DropdownMenuContent align="end">
    {r.payslipId&&<DropdownMenuItem onClick={()=>void pdf(r)}>Download PDF</DropdownMenuItem>}
    {canGenerate&&r.canGenerate&&r.status==='Not generated'&&<DropdownMenuItem onClick={()=>requestJob('generate',[r])}>Generate payslip</DropdownMenuItem>}
    {canGenerate&&r.canGenerate&&r.status==='Generated'&&<DropdownMenuItem onClick={()=>requestJob('regenerate',[r])}>Regenerate draft</DropdownMenuItem>}
    {canPublish&&r.status==='Generated'&&<DropdownMenuItem onClick={()=>requestJob('publish',[r])}>Publish payslip</DropdownMenuItem>}
    {canPublish&&r.status==='Published'&&<DropdownMenuItem disabled={!data?.emailConfigured||!candidates('email',[r]).length} onClick={()=>requestJob('email',[r])}>{r.emailStatus==='Failed'?'Retry failed email':'Email payslip'}</DropdownMenuItem>}
    {data?.canManage&&r.payslipId&&<DropdownMenuItem onClick={()=>void showHistory(r)}>Email &amp; generation history</DropdownMenuItem>}
    {!r.payslipId&&!r.canGenerate&&<DropdownMenuItem disabled>Awaiting payroll</DropdownMenuItem>}
   </DropdownMenuContent></DropdownMenu>
  </div>},
 ];
 return <div className="space-y-5">
  <PageHeader title="Payslips" subtitle="Generate and distribute payslips from saved payroll. No salary transfers are made here." breadcrumb="Payroll / Payslips" actions={<FilterSelect value={month} onChange={setMonth} options={payrollMonths} ariaLabel="Payslip month"/>}/>
  {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4"><p>{error}</p><Button variant="outline" className="mt-2" onClick={()=>void load()}>Retry</Button></div>}
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard icon={Users} label="Total Employees" value={loading?'...':String(rows.length)} tone="blue"/><StatCard icon={Wallet} label="Total Net Payable" value={loading?'...':formatINR(rows.reduce((sum,row)=>sum+(row.netMinor??0),0)/100)} tone="green" helperText="Saved salary calculations"/><StatCard icon={FileText} label="Generated Payslips" value={loading?'...':String(rows.filter(row=>row.payslipId).length)} tone="purple"/><StatCard icon={Mail} label="Emails Sent" value={loading?'...':String(rows.filter(row=>row.emailsSent).length)} tone="cyan" helperText="Accepted by email provider"/></div>
  {data?.canManage&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"><p className="max-w-3xl text-sm text-muted-foreground">Calculate, approve and lock an employee payroll batch before generating. Published payslips preserve their saved figures. Select employees below for bulk actions. <Link href="/payroll" className="text-primary underline">Review payroll</Link></p><Button size="sm" variant="outline" disabled={!!busy||loading} onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></div>}
  {data?.canManage&&!data.emailConfigured&&<p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">Email sending is not configured. Your administrator must add the Resend API key and a verified payslip sender. PDF generation and downloads remain available.</p>}
  <SectionCard noPadding>
   <div className="space-y-3 border-b p-4"><div className="flex flex-wrap gap-3"><SearchInput value={search} onChange={setSearch} placeholder="Search employee name or ID" className="w-full sm:w-64"/><FilterSelect value={department} onChange={setDepartment} options={['All',...new Set(rows.map(row=>row.department).filter(Boolean))]} ariaLabel="Department"/><FilterSelect value={status} onChange={setStatus} options={['All','Not generated','Generated','Published']} ariaLabel="Payslip status"/><FilterSelect value={emailStatus} onChange={setEmailStatus} options={['All','Not sent','Sent','Failed','Sending','Unconfirmed']} ariaLabel="Email status"/></div>
   <div className="flex flex-wrap items-center gap-2"><span className="mr-2 text-xs text-muted-foreground">{targets.length} selected in this view</span>{canGenerate&&<Button size="sm" disabled={!!busy||!candidates('generate').length} onClick={()=>requestJob('generate')}>Generate selected</Button>}{canGenerate&&<Button size="sm" variant="outline" disabled={!!busy||!candidates('regenerate').length} onClick={()=>requestJob('regenerate')}>Regenerate drafts</Button>}{canPublish&&<Button size="sm" variant="outline" disabled={!!busy||!candidates('publish').length} onClick={()=>requestJob('publish')}>Publish selected</Button>}<Button size="sm" variant="outline" disabled={!!busy||!targets.some(row=>row.payslipId)} onClick={()=>void zip()}>Download ZIP (up to 25)</Button>{canPublish&&<Button size="sm" variant="outline" disabled={!!busy||!data?.emailConfigured||!candidates('email').length} onClick={()=>requestJob('email')}>Email / retry selected</Button>}{busy&&<span role="status" className="text-sm text-muted-foreground">Working...</span>}</div></div>
   <DataTable columns={columns} data={filtered} loading={loading} pageSize={10} getRowId={row=>row.employeeId} selectedIds={selected} onSelectionChange={setSelected} emptyTitle="No employees for this month" emptyDescription="Check the selected month and filters. Calculated employees appear here before their payslips are generated."/>
  </SectionCard>
  <ConfirmDialog open={!!job} onOpenChange={open=>{if(!open&&!busy)setJob(null);}} title={`${job?.action==='email'?'Email':job?.action==='publish'?'Publish':job?.action==='regenerate'?'Regenerate':'Generate'} ${job?.rows.length??0} payslip(s)?`} description={job?.action==='email'?'Send published PDF payslips to the selected employees at their saved work email addresses. Email attempts are recorded. No salary transfer is made.':job?.action==='publish'?'Make these payslips available to their employees. Published salary figures cannot be overwritten.':job?.action==='regenerate'?'Rebuild this draft from its locked payroll snapshot. The previous draft is archived.':'Use the existing locked salary calculations. Salary amounts will not be recalculated.'} confirmLabel={job?.action==='email'?'Send emails':'Confirm'} loading={!!busy} onConfirm={()=>void runJob()}/>
  <Dialog open={!!preview} onOpenChange={open=>{if(!open)setPreview(null);}}><DialogContent className="sm:max-w-4xl"><DialogHeader><DialogTitle>Payslip preview</DialogTitle><DialogDescription>{preview?.name} / {month}</DialogDescription></DialogHeader>{preview&&<iframe title="Payslip PDF preview" src={preview.url} className="h-[70vh] w-full rounded-md border"/>}</DialogContent></Dialog>
  <Dialog open={!!history} onOpenChange={open=>{if(!open)setHistory(null);}}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Payslip history</DialogTitle><DialogDescription>{history?.name}. Sent means accepted by the provider, not confirmed inbox delivery.</DialogDescription></DialogHeader><h3 className="font-semibold">Email attempts</h3>{!history?.emails.length&&<p className="text-sm text-muted-foreground">No emails requested.</p>}{history?.emails.map(attempt=><div key={attempt.id} className="space-y-1 rounded-lg border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="break-all">{attempt.recipient}</span><StatusBadge status={attempt.status}/></div><p className="text-xs text-muted-foreground">{dateLabel(attempt.created_at)}</p>{attempt.provider_id&&<p className="break-all text-xs text-muted-foreground">Provider reference: {attempt.provider_id}</p>}{attempt.error_code&&<p>{payslipEmailMessage[attempt.error_code]??'Review provider status.'}</p>}{['Sending','Unconfirmed'].includes(attempt.status)&&<p className="text-xs text-muted-foreground">Check the provider outcome before another send. Automatic retries are blocked to avoid duplicates.</p>}</div>)}<h3 className="mt-3 font-semibold">Previous draft generations</h3>{!history?.revisions.length&&<p className="text-sm text-muted-foreground">No regenerated drafts.</p>}{history?.revisions.map(revision=><p key={revision.id} className="rounded border p-3 text-sm">Payroll version {revision.run_version} / generated {dateLabel(revision.generated_at)} / archived {dateLabel(revision.archived_at)}</p>)}</DialogContent></Dialog>
 </div>;
}
