# Accounting rules

Posting requires an open financial year, active tenant ledgers and at least two lines, each with one positive debit or credit. Integer-paise totals must balance exactly. Posted entries cannot be edited; corrections create linked reversing entries. Writes and audit share transactions. Reports include both the original posted entry and its posted reversal, so their balances offset; drafts are excluded.

Locked payroll accrual uses configured mappings, captured payroll snapshots and duplicate prevention. Migration 020 records mappings for newly posted accruals. Pre-020 accruals do not automatically acquire mapping snapshots; they need a reviewed historical migration/correction before preparing payment instructions.

Invoice drafts are versioned. Posting captures parties and requires appropriate control/base/tax ledgers. Quantities allow three decimals; prices/discounts are paise. GST rates are explicit configuration; taxed posting needs a review reference. These are bookkeeping records, not government submissions or proof of input-credit eligibility.

Invoice payments require actual date, amount, unique bank reference and reviewed evidence; overpayment is rejected. Salary payments additionally need current locked instructions and verified captured bank details. Partial payments retain an outstanding amount. Preparing/exporting instructions does not record payment.

Source journals cannot be reversed through the generic journal action. Correct their source payments first; cancel invoices only after correcting confirmed payments. A book reversal does not initiate a refund or cancel a statutory filing.

Bank/cash balances derive from posted ledgers, not reconciled provider balances. Movement charts include transfers and are not formal cash-flow statements. GST filing, bank reconciliation/provider connectivity and financial-period administration remain incomplete.
