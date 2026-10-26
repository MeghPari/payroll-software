export function payrollGuidance(input:{attendanceFinalized:boolean;status?:string;posted?:boolean;disbursed?:boolean}){
 if(!input.status||input.status==='Draft')return{title:'Calculate employee salaries',description:'Calculate employees with complete attendance for their employment dates. Other employees remain pending.',label:'Calculate salaries',href:'/payroll',step:1};
 if(input.status==='Calculated')return{title:'Review and approve salaries',description:'Review each employee’s payable days, deductions and net salary before approving.',label:'Review salaries',href:'/payroll',step:1};
 if(input.status==='Approved')return{title:'Lock the approved salaries',description:'Lock the reviewed payroll before preparing payslips and payments.',label:'Lock payroll',href:'/payroll',step:1};
 if(!input.posted)return{title:'Prepare salaries for payment',description:'Post the approved payroll entry, then prepare the bank instructions.',label:'Prepare salary payments',href:'/disbursement',step:2};
 if(!input.disbursed)return{title:'Complete salary payments',description:'Prepare bank instructions and record confirmed transfers. Track what remains unpaid.',label:'Open salary payments',href:'/disbursement',step:2};
 return{title:'Salary payments recorded',description:'Review payment records and publish payslips for your employees.',label:'View salary payments',href:'/disbursement',step:3};
}
