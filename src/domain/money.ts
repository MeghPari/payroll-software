// All inputs/outputs are integer minor units. BigInt intermediates avoid rounding drift.
export function minor(value: number): bigint {
  if (!Number.isSafeInteger(value)) throw new Error('Money must be safe integer minor units.');
  return BigInt(value);
}
export function ratio(amount: number, numerator: number, denominator: number, rounding: 'half-up' | 'down' = 'half-up'): number {
  const a = minor(amount), n = minor(numerator), d = minor(denominator);
  if (n < BigInt(0) || d <= BigInt(0)) throw new Error('Invalid ratio.');
  const raw = a * n;
  const sign = raw < BigInt(0) ? -BigInt(1) : BigInt(1);
  const absolute = raw * sign;
  const rounded = ((absolute + (rounding === 'half-up' ? d / BigInt(2) : BigInt(0))) / d) * sign;
  const output = Number(rounded); minor(output); return output;
}
export function sum(values: number[]): number {
  const output = Number(values.reduce((total, value) => total + minor(value), BigInt(0)));
  minor(output); return output;
}
export function balanced(lines: { debit: number; credit: number }[]): boolean {
  if (lines.length < 2) return false;
  for (const line of lines) {
    minor(line.debit); minor(line.credit);
    if (line.debit < 0 || line.credit < 0 || (line.debit === 0) === (line.credit === 0)) return false;
  }
  return sum(lines.map(line => line.debit)) === sum(lines.map(line => line.credit));
}
