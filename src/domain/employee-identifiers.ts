import {z} from 'zod';
const compact=z.string().transform(value=>value.replace(/\s+/g,'').toUpperCase());
export const bankDetailsInput=z.object({
 accountHolderName:z.string().trim().max(160,'Account holder name must be at most 160 characters.'),
 accountNumber:compact.pipe(z.string().regex(/^(?:[0-9]{6,34})?$/,'Account number must contain 6 to 34 digits, or be blank.')),
 ifscCode:compact.pipe(z.string().regex(/^(?:[A-Z]{4}0[A-Z0-9]{6})?$/,'IFSC must have 11 characters: 4 letters, then 0, then 6 letters or digits.')),
 bankName:z.string().trim().max(160),branch:z.string().trim().max(160),
}).strict();
export const statutoryIdentifiersInput=z.object({
 aadhaar:compact.pipe(z.string().regex(/^(?:[0-9]{12})?$/,'Aadhaar number must contain 12 digits, or be blank.')).optional(),
 pan:compact.pipe(z.string().regex(/^(?:[A-Z]{5}[0-9]{4}[A-Z])?$/,'PAN must have 5 letters, 4 digits and a final letter, or be blank.')).optional(),
 uan:compact.pipe(z.string().regex(/^(?:[0-9]{12})?$/,'UAN must contain 12 digits, or be blank.')).optional(),
 esicNumber:z.string().trim().max(30,'ESIC number must be at most 30 characters.').optional(),
}).strict();
