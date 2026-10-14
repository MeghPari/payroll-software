import type { Employee,DailyAttendanceRecord } from '@/types';
export function dailyAttendanceRoster(employees:Employee[],records:DailyAttendanceRecord[],date:string){
 const byEmployee=new Map(records.filter(record=>record.date===date).map(record=>[record.employeeId,record]));
 return employees.filter(employee=>employee.joiningDate<=date&&(!employee.exitDate||employee.exitDate>=date)&&!['Inactive','Salary Hold'].includes(employee.status)).map(employee=>({employee,record:byEmployee.get(employee.id)}));
}
