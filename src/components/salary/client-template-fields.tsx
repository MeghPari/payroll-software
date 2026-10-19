import {CLIENT_SALARY_COLUMNS} from '@/domain/client-template-columns';

function source(index:number){
 if(index<=10)return 'Employee record';
 if(index<=12)return 'Monthly attendance';
 if([13,14,19].includes(index))return 'Monthly salary adjustments';
 if(index<=18)return 'Employee salary';
 if(index===20||index===24||index===38)return 'Calculated payroll';
 if(index<=25)return 'Configured statutory payroll';
 if(index===32)return 'Advance payment reference';
 if(index<=34)return 'Reviewed client costs';
 if(index<=37)return 'Monthly recovery adjustments';
 return 'Payroll / setup status';
}

export function ClientTemplateFields(){
 return <section aria-label="Salary Structure Excel fields">
  <h3 className="mb-2 text-sm font-semibold">Salary_Structure.xlsx fields</h3>
  <p className="mb-3 text-xs text-muted-foreground">The same 40 fields, labels and order as your workbook. Employee amounts and monthly calculations appear in the salary sheet above.</p>
  <div className="overflow-hidden rounded-lg border">
   <table className="w-full text-left text-sm">
    <thead className="bg-muted/50 text-xs"><tr><th className="px-4 py-3">Excel field</th><th className="px-4 py-3">Value from</th></tr></thead>
    <tbody className="divide-y">{CLIENT_SALARY_COLUMNS.map((label,index)=><tr key={label}><td className="px-4 py-3 font-medium">{label}</td><td className="px-4 py-3 text-xs text-muted-foreground">{source(index)}</td></tr>)}</tbody>
   </table>
  </div>
 </section>;
}
