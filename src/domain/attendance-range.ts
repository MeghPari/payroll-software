import type { AttendanceStatus, DailyAttendanceRecord } from '@/types';

export interface AttendanceCalendar {
 holidays:{date:string;active:boolean;review_reference:string|null}[];
 schedules:{employee_id:string|null;effective_from:string;effective_to:string|null;working_days:number[];active:boolean}[];
}

// Explicitly enabled for a new date range. Single-day edits and CSV entries
// retain their recorded status, including actual Sunday work.
export function calendarAttendanceRange(record:DailyAttendanceRecord,dates:string[],calendar:AttendanceCalendar,applyCalendar:boolean):DailyAttendanceRecord[]{
 return dates.map(date=>{
  let status:AttendanceStatus=record.status;
  if(applyCalendar){
   const schedule=calendar.schedules.filter(s=>s.active&&(s.employee_id===record.employeeId||s.employee_id===null)&&s.effective_from<=date&&(!s.effective_to||s.effective_to>=date))
    .sort((a,b)=>Number(b.employee_id!==null)-Number(a.employee_id!==null)||b.effective_from.localeCompare(a.effective_from))[0];
   const day=new Date(`${date}T00:00:00Z`).getUTCDay();
   if(calendar.holidays.some(h=>h.active&&h.review_reference&&h.date===date))status='Holiday';
   else if(schedule?!schedule.working_days.includes(day):day===0)status='Weekly Off';
  }
  return {...record,date,status,...(status!==record.status?{checkIn:'',checkOut:'',workHours:0,overtime:0,leaveType:''}:{})};
 });
}
