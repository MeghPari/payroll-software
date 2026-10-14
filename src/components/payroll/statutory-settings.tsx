'use client';
import { useEffect,useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { tenantApi,permitted } from '@/lib/tenant-api';
import { toMinor } from '@/domain/currency';
import { useSessionStore } from '@/store/session-store';
import { toast } from 'sonner';
interface Rule{id:string;code:string;state:string;effective_from:string;effective_to:string;employee_basis_points:number;employer_basis_points:number;verification_reference:string}
export function StatutorySettings({embedded=false}:{embedded?:boolean}={}){
 const companyId=useSessionStore(s=>s.companyId),session=useSessionStore(s=>s.session);
 const company=session?.memberships.find(m=>m.company_id===companyId);
 const[rules,setRules]=useState<Rule[]>([]),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[busy,setBusy]=useState(false);
 const [form,setForm]=useState({code:'pf',state:'',effectiveFrom:'',effectiveTo:'',wageComponents:'basic',employeeRate:'',employerRate:'',wageCap:'',fixed:'',verificationReference:''});
 useEffect(()=>{let cancelled=false;tenantApi<Rule[]>('statutory-rules').then(value=>{if(!cancelled){setRules(value);setError('');}}).catch(error=>{if(!cancelled){setRules([]);setError(error.message);}});return()=>{cancelled=true;};},[companyId,refresh]);
 async function save(){setBusy(true);try{await tenantApi('statutory-rules',{method:'POST',body:JSON.stringify({code:form.code,state:form.state,effectiveFrom:form.effectiveFrom,effectiveTo:form.effectiveTo,wageComponents:form.wageComponents.split(',').map(value=>value.trim()),employeeBasisPoints:toMinor(form.employeeRate),employerBasisPoints:toMinor(form.employerRate),wageCapMinor:form.wageCap?toMinor(form.wageCap):null,fixedMinor:toMinor(form.fixed),verificationReference:form.verificationReference})});setRefresh(n=>n+1);toast.success('Reviewed rule saved');}catch(error){toast.error(error instanceof Error?error.message:'Unable to save rule.');}finally{setBusy(false);}}
 return <div className="space-y-5">{!embedded&&<PageHeader title="Settings" subtitle="Manage reviewed company payroll configuration."/>}<SectionCard title="Company"><p>{company?.companies.name}</p><p className="mt-2 text-sm text-muted-foreground">Currency: INR. Calculations currently use calendar-day salary proration and half-up paise rounding.</p></SectionCard>
 {error&&<p role="alert" className="text-red-700">{error}</p>}
 <SectionCard title="Reviewed statutory rules" subtitle="Each rule records its review reference and effective period. Saved versions are retained."><div className="space-y-3">{rules.map(rule=><div key={rule.id}className="rounded-lg border p-3"><strong>{rule.code.toUpperCase()}</strong> · {rule.state||'All states'} · {rule.effective_from} to {rule.effective_to}<p className="text-sm text-muted-foreground">Employee: {rule.employee_basis_points/100}% · Employer: {rule.employer_basis_points/100}% · {rule.verification_reference}</p></div>)}{!rules.length&&!error&&<p className="text-sm text-muted-foreground">No reviewed rules configured.</p>}</div></SectionCard>
 {permitted('settings.write')&&<SectionCard title="Add reviewed rule" subtitle="Enter the configuration reviewed for this company. Percentage plus fixed deduction rules are supported; complex annual tax calculations require separate reviewed calculations."><div className="grid gap-4 sm:grid-cols-3"><div><Label htmlFor="rule-code">Contribution</Label><select id="rule-code"className="h-10 w-full rounded-md border bg-background px-3"value={form.code}onChange={e=>setForm({...form,code:e.target.value})}>{['pf','esi','pt','tds'].map(code=><option key={code}value={code}>{code.toUpperCase()}</option>)}</select></div>{([{key:'state',label:'State (blank for all)'},{key:'effectiveFrom',label:'Effective from',type:'date'},{key:'effectiveTo',label:'Effective to',type:'date'},{key:'wageComponents',label:'Wage codes, comma separated'},{key:'employeeRate',label:'Employee rate (%)'},{key:'employerRate',label:'Employer rate (%)'},{key:'wageCap',label:'Wage cap (₹, blank for no cap)'},{key:'fixed',label:'Fixed deduction (₹)'},{key:'verificationReference',label:'Review reference / approval record'}]as const).map(field=><div key={field.key}><Label htmlFor={'rule-'+field.key}>{field.label}</Label><Input id={'rule-'+field.key}type={'type'in field?field.type:'text'}value={form[field.key]}onChange={e=>setForm({...form,[field.key]:e.target.value})}/></div>)}</div><Button className="mt-4"disabled={busy}onClick={save}>Save reviewed configuration</Button></SectionCard>}
 </div>;
}
