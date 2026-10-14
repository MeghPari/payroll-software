import { z } from 'zod';

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Use a valid calendar date.');
const time = z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?)?$/);
export const attendanceInput = z.object({
  reason: z.string().trim().max(1000).default(''),
  allowUpdate: z.boolean().default(false),
  rows: z.array(z.object({
    employeeId: z.string().uuid(), date: calendarDate,
    status: z.enum(['Present','Absent','Paid Leave','Unpaid Leave','Half Day','Weekly Off','Holiday','Work From Home','Missing Punch']),
    shift: z.string().max(100), checkIn: time, checkOut: time,
    workMinutes: z.number().int().min(0).max(1440), overtimeMinutes: z.number().int().min(0).max(1440),
    leaveType: z.string().max(100), remarks: z.string().max(1000),
  }).strict()).min(1).max(1000),
}).strict().superRefine((input, context) => {
  if (input.allowUpdate && !input.reason) context.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'Enter a reason for correcting attendance.' });
  const seen = new Set<string>();
  input.rows.forEach((row, index) => {
    const key = `${row.employeeId}/${row.date}`;
    if (seen.has(key)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['rows', index, 'date'], message: 'An employee date can appear only once.' });
    seen.add(key);
  });
}).transform(input => ({ ...input, reason: input.reason || 'Initial attendance entry' }));
