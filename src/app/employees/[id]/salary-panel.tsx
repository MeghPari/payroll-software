'use client';
import Link from 'next/link';
import {SectionCard} from '@/components/shared/section-card';
import {formatINR} from '@/utils/format';
import type {Employee,SalaryProfile} from '@/types';
export function SalaryPanel({employee,salary}:{employee:Employee;salary:SalaryProfile|undefined;onChanged:()=>void}){
 return <SectionCard title="Employee dataset salary" subtitle={employee.fullName}><p className="mb-4 text-sm text-muted-foreground">Salary components are saved from the uploaded employee dataset. To revise them, upload a reviewed dataset with this Employee Code and a salary revision date.</p>
 {salary?<dl className="grid gap-3 sm:grid-cols-2">{Object.entries({'Basic':salary.basic,'DA':salary.da??0,'HRA':salary.hra,'Other Allowance':salary.other}).map(([label,value])=><div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="font-medium">{formatINR(value)}</dd></div>)}<div><dt className="text-sm text-muted-foreground">Effective from</dt><dd>{salary.effectiveFrom}</dd></div></dl>:<p>No dataset salary has been uploaded for this employee.</p>}
 <Link href="/salary-structures" className="mt-4 inline-block text-primary underline">Upload Employee Dataset / View salaries</Link></SectionCard>;
}
