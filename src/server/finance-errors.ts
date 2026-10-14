import { ApiError,databaseError } from './http';
const messages:Record<string,string>={
 'Cash flow allocations must equal the posted cash movement':'The signed allocations must add up exactly to the posted bank/cash movement.',
 'A nonzero bank or cash movement is required':'This journal has no net movement in the configured bank/cash accounts.',

 'Matching failed attempt required for retry':'Choose a saved failed attempt for this employee and batch, and keep the retry within its amount and outstanding salary.',
 'Actual attempt date, amount, reference and evidence required':'Enter the actual attempt date, positive amount, unique reference and reviewed evidence.',
 'Resolve draft documents before closing year':'Post or cancel draft invoices and journals before closing this financial year.',
 'Complete payroll and its accrual before closing year':'Complete each existing payroll run and its accrual before closing the financial year.',

 'Credit exceeds remaining invoice components':'The credit exceeds the remaining taxable or GST amount after existing notes.',
 'Correct purchase credit eligibility before posting note':'Review and reduce purchase credit eligibility before this tax reduction or note reversal.',
 'Note would overpay or exceed invoice amount limit':'Correct confirmed payment evidence before reducing the invoice below its paid amount.',
 'Correct payment entries before reversing debit note':'Correct the confirmed payment entries before reversing this debit note.',
 'Reverse dependent credit notes first':'Reverse credit notes that depend on this debit note before correcting it.',
 'Reverse invoice notes before cancelling invoice':'Reverse the active invoice notes before cancelling the original invoice.',

 'Accounting period closed; reopen with an audited reason':'This accounting month is closed. An authorized accountant must reopen it with a reason before posting.',
 'Resolve draft documents before closing period':'Post or cancel all draft invoices and journals in this month before closing it.',
 'Complete payroll and its accrual before closing period':'Complete the month?s payroll and post its accrual before closing the accounting month.',
 'Only completed accounting periods can close':'Close an accounting month only after its last date has passed.',
 'Only completed financial years can close':'A financial year can be closed only after its end date.',
 'Manual draft and correction reason required':'Only a manual draft voucher can be edited. Enter a correction reason.',
 'Open financial year required':'Configure an open financial year covering the month first.',
 'Configure an open financial year covering this date':'Configure an open financial year covering this document date before posting.',
 'Reviewed tax reference required':'Enter a reviewed tax reference before posting this invoice.',
 'Invoice ledger classification invalid':'Select active company ledgers with the required account types for this invoice.',
 'Tax ledger required':'Select ledgers for each applicable GST component before posting.',
 'Discount exceeds line amount':'A line discount cannot exceed its quantity multiplied by unit price.',
 'Payment exceeds outstanding amount':'The payment exceeds the invoice’s remaining balance. Refresh and check the amount.',
 'Use the source document correction workflow':'Correct this entry through its source invoice or payment workflow.',
 'Reverse payment entries before cancelling invoice':'Reverse the recorded payment entries before cancelling the invoice in the books.',
 'Funding and invoice control ledgers must differ':'Use a separate bank or cash ledger for payment; it cannot be the invoice’s receivable or payable ledger.',
 'Posted invoice and confirmed payment evidence required':'A posted invoice, valid payment date, amount, reference and reviewed evidence are required.',
 'Positive draft invoice required':'Only a draft invoice with a positive total can be posted.',
 'Post payroll accrual before preparing payments':'Post this locked month’s payroll accrual in Payroll Accounting before preparing payment instructions.',
 'Review and verify employee bank details before preparing payments':'Review each employee’s account holder, account number and IFSC, then verify bank details in their KYC tab before preparing payment instructions.',
 'Payroll payable liability ledger required':'Configure the payroll net-payable mapping with an active liability ledger before preparing payments.',
 'Payment exceeds outstanding salary':'This amount exceeds the employee’s remaining salary payment. Refresh and check the outstanding amount.',
 'Current locked payroll payment instructions required':'These instructions no longer match the locked payroll. Cancel the unused batch and prepare current instructions.',
 'Correct recorded payments before cancelling instructions':'Correct the confirmed payment entries before cancelling these instructions.',
 'Locked payroll required':'Calculate, approve and lock payroll for the selected month before continuing.',
 'Company bank account required':'Configure a company bank account in Banking and select it here.',
 'Confirmed salary payment evidence required':'Enter an actual payment date within this payroll month or later, a reference and reviewed evidence for the salary payment.',
 'No positive salary payments to prepare':'This payroll has no positive salary payments to prepare.',
};
export function financeError(error:{code?:string;message:string}|null){
 if(error&&['23514','22023'].includes(error.code??'')&&messages[error.message])throw new ApiError(422,'FINANCE_VALIDATION',messages[error.message]);
 databaseError(error);
}
