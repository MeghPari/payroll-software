import { minor, ratio, sum } from './money';
export interface ContributionRule {
  code: string; version: string; effectiveFrom: string; effectiveTo?: string;
  verified: boolean; employeeBasisPoints: number; employerBasisPoints: number;
  wageCapMinor?: number;
}
export interface PayrollInput {
  periodDate: string; scheduledDays: number; paidDays: number;
  earnings: { code: string; amountMinor: number; prorate: boolean }[];
  deductions: { code: string; amountMinor: number }[];
  contributions: { wageMinor: number; rule: ContributionRule }[];
  rounding: 'half-up' | 'down';
}
// Effective-dated, reviewed inputs are required. No universal PF/ESI/TDS defaults.
export function calculatePayroll(input: PayrollInput) {
  if (!Number.isInteger(input.scheduledDays) || input.scheduledDays < 1 || input.scheduledDays > 366 || !Number.isInteger(input.paidDays) || input.paidDays < 0 || input.paidDays > input.scheduledDays) throw new Error('Invalid payable days.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.periodDate)) throw new Error('Invalid period date.');
  const earnings = input.earnings.map(item => ({ ...item, amountMinor: item.prorate ? ratio(item.amountMinor, input.paidDays, input.scheduledDays, input.rounding) : Number(minor(item.amountMinor)) }));
  const contributions = input.contributions.map(({ wageMinor, rule }) => {
    minor(wageMinor);
    if (wageMinor < 0 || !rule.verified || !rule.version || input.periodDate < rule.effectiveFrom || (rule.effectiveTo && input.periodDate > rule.effectiveTo)) throw new Error('Contribution rule requires effective-date verification.');
    for (const rate of [rule.employeeBasisPoints, rule.employerBasisPoints]) if (!Number.isInteger(rate) || rate < 0 || rate > 10000) throw new Error('Invalid contribution rate.');
    if (rule.wageCapMinor !== undefined && minor(rule.wageCapMinor) < BigInt(0)) throw new Error('Invalid wage cap.');
    const wage = rule.wageCapMinor === undefined ? wageMinor : Math.min(wageMinor, rule.wageCapMinor);
    return { code: rule.code, ruleVersion: rule.version, employeeMinor: ratio(wage, rule.employeeBasisPoints, 10000, input.rounding), employerMinor: ratio(wage, rule.employerBasisPoints, 10000, input.rounding) };
  });
  for (const deduction of input.deductions) if (minor(deduction.amountMinor) < BigInt(0)) throw new Error('Deductions must be nonnegative.');
  const grossMinor = sum(earnings.map(item => item.amountMinor));
  const deductionsMinor = sum([...input.deductions.map(item => item.amountMinor), ...contributions.map(item => item.employeeMinor)]);
  const netMinor = sum([grossMinor, -deductionsMinor]);
  if (netMinor < 0) throw new Error('Negative payable salary requires an exception workflow.');
  const employerContributionsMinor = sum(contributions.map(item => item.employerMinor));
  return { earnings, deductions: input.deductions, contributions, grossMinor, deductionsMinor, netMinor, employerContributionsMinor, employerCostMinor: sum([grossMinor, employerContributionsMinor]) };
}
