"use client";
import {DesignationInput} from '@/components/employees/designation-input';
import {Input} from '@/components/ui/input';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {downloadCSV} from '@/lib/csv';
import {readImportSheet,readImportRecords} from '@/lib/spreadsheet-import';
import {parseCSVMatrix} from '@/domain/csv';
import {clientAttendanceRows,clientAttendanceTemplate,type AttendanceCodePolicy} from '@/domain/client-attendance';

import { BulkUploadDialog, type PreviewColumn } from "@/components/shared/bulk-upload-dialog";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/shared/filter-select";
import {
    bulkImportAttendance,
  validateAttendanceImport,
  type AttendanceImportRow,
} from "@/services/attendance.service";
import { payrollMonths,useAppStore } from "@/store/app-store";
import { monthKey as monthKeyFromLabel } from '@/domain/dates';
import type { ImportRowResult } from "@/types";


function parseRow(record: Record<string, string>): AttendanceImportRow {
  return {
    employeeId: record["Employee ID"] ?? record["Employee Code"] ?? "",
    employeeName: record["Employee Name"],designation:record["Designation"],joiningDate:record["Joining Date"]??record["Date of Joining (DOJ)"]??record["DOJ"],counterCode:record["Counter Code"],counterName:record["Counter Name"],location:record["Location"],state:record["State"],department:record["Function"],
    date: record["Date"] ?? "",
    shift: record["Shift"] ?? "",
    checkIn: record["Check-In"] ?? "",
    checkOut: record["Check-Out"] ?? "",
    workHours: record["Work Hours"] ?? "",
    status: record["Attendance Status"] ?? record["Status"] ?? "",
    leaveType: record["Leave Type"] ?? "",
    overtime: record["Overtime"] ?? "",
    remarks: record["Remarks"] ?? "",
  };
}

const previewColumns: PreviewColumn<ImportRowResult<AttendanceImportRow>>[] = [
  { header: "Employee ID", cell: (r) => r.data.employeeId },
  { header: "Date", cell: (r) => r.data.date },
  { header: "Status", cell: (r) => r.data.status },
  { header: "Check-In", cell: (r) => r.data.checkIn || "—" },
  { header: "Check-Out", cell: (r) => r.data.checkOut || "—" },
];

interface BulkUploadAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (count: number) => void;
}

export function BulkUploadAttendanceDialog({ open, onOpenChange, onImported }: BulkUploadAttendanceDialogProps) {
  const [leave,setLeave]=useState<AttendanceCodePolicy['leave']>('Paid Leave'),[holiday,setHoliday]=useState<AttendanceCodePolicy['holiday']>('Holiday');
  const [joiningDate,setJoiningDate]=useState(''),[designation,setDesignation]=useState('Other');
  const month=useAppStore(state=>state.month),setMonth=useAppStore(state=>state.setMonth);

  return (
    <BulkUploadDialog<AttendanceImportRow>
      key={month}
      open={open}
      onOpenChange={onOpenChange}
      title="Upload Attendance"
      description="Import attendance for the selected month. Dates may use YYYY-MM-DD or DD-MM-YYYY (DD/MM/YYYY also works)."
      templateFileName="Attendance_Template.xlsx"
      onDownloadTemplate={()=>{const link=document.createElement('a');link.href='/templates/Attendance_Template.xlsx';link.download='Attendance_Template.xlsx';link.click();}}
      templateColumns={['Employee Code','Employee Name','Counter Code','Counter Name','Location','State','Function','Daily attendance dates','Present','WFH','Half Day','Leave','Absent']}
      sampleRows={[]}
      parseRow={parseRow}
      parseFile={async file=>{if(file.size>2000000)throw new Error('Import files must be under 2 MB.');const matrix=/\.xlsx$/i.test(file.name)?await readImportSheet(file):parseCSVMatrix(await file.text());if(matrix[0]?.[0]==='Employee Code'&&matrix[0]?.[1]==='Employee Name'&&matrix[0]?.[2]==='Counter Code')return clientAttendanceRows(matrix,monthKeyFromLabel(month),{leave,holiday}).map(row=>({...row,joiningDate:row.joiningDate||joiningDate,designation:row.designation||designation}));return(await readImportRecords(file)).map(parseRow).map(row=>({...row,joiningDate:row.joiningDate||joiningDate,designation:row.designation||designation}));}}
      validateRows={rows=>validateAttendanceImport(rows,monthKeyFromLabel(month))}
      previewColumns={previewColumns}
      onImport={async (rows) => {
        const record = await bulkImportAttendance(rows, monthKeyFromLabel(month));
        onImported(rows.length);
        return record;
      }}
      extraField={
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">Client monthly grids are supported. L means paid leave. H means paid holiday, including Sundays and weekly offs. Blank dates remain unrecorded.</p>
          <Button variant="outline" onClick={()=>{const template=clientAttendanceTemplate(monthKeyFromLabel(month));downloadCSV('Attendance_Template-'+monthKeyFromLabel(month)+'.csv',template.headers,template.rows);}}>Download client monthly grid</Button>
          <Label>Designation for new employees (if absent from file)</Label><DesignationInput value={designation} onChange={setDesignation}/><Label htmlFor="new-employee-joining">Joining date for new employees (if absent from file)</Label><Input id="new-employee-joining" type="date" value={joiningDate} onChange={event=>setJoiningDate(event.target.value)}/><p className="text-xs text-muted-foreground">Unknown codes will create employees. Supply Employee Name and Joining Date in the file, or use this date for new employees only. Employee creation permission is required. Existing profiles are unchanged. For mixed new designations, import the Employee Database first or upload each designation separately.</p>
          <Label>Select Payroll Month</Label>
          <FilterSelect value={month} onChange={setMonth} options={payrollMonths} className="w-full bg-white" />
          <Label htmlFor="grid-leave">L code</Label><select id="grid-leave" className="h-10 w-full rounded-md border px-3" value={leave??''} onChange={event=>setLeave(event.target.value as AttendanceCodePolicy['leave'])}><option value="">Choose if used</option><option>Paid Leave</option><option>Unpaid Leave</option></select>
          <Label htmlFor="grid-holiday">H code</Label><select id="grid-holiday" className="h-10 w-full rounded-md border px-3" value={holiday??''} onChange={event=>setHoliday(event.target.value as AttendanceCodePolicy['holiday'])}><option value="">Choose if used</option><option>Holiday</option><option>Weekly Off</option></select>
        </div>
      }
    />
  );
}
