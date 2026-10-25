import {z} from 'zod';
import {normalizeAttendanceImportDate} from './attendance-import-date';
const money=z.number().int().nonnegative().max(9000000000000);
export const employeeSalaryInput=z.object({
 employeeId:z.string().uuid(),expectedVersion:z.number().int().positive(),
 effectiveFrom:z.string().refine(value=>normalizeAttendanceImportDate(value)===value,'Use a valid salary effective date.'),
 amounts:z.object({basic:money,da:money.default(0),hra:money.default(0),other:money.default(0)}).strict(),
 references:z.object({pfMinor:money.nullable().optional(),esiMinor:money.nullable().optional(),ctcMinor:money.nullable().optional()}).strict().default({}),
 remarks:z.string().trim().max(1000).default('')
}).strict();
