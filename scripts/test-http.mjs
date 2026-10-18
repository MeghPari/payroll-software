import assert from 'node:assert/strict';
const base = process.env.TEST_APP_URL ?? 'http://localhost:3100';
const protectedPaths = ['/api/employees/client-export', '/api/payroll/client-sheet?month=2026-09', '/api/payroll/client-costs?month=2026-09', '/api/payroll/illustration?month=2026-09', '/api/auth/session', '/api/announcements', '/api/gst/reviews', '/api/cash-flow', '/api/payroll/corrections', '/api/disbursements/attempts', '/api/support', '/api/compliance', '/api/gst?month=2026-09', '/api/notifications', '/api/attendance/calendar', '/api/payroll/adjustments?month=2026-09-01', '/api/banking/reconciliation', '/api/employees/documents', '/api/employees/account', '/api/invoices/pdf', '/api/invoices/notes', '/api/dashboard', '/api/reports?month=2026-09&kind=trial-balance', '/api/employees', '/api/users', '/api/audit-logs', '/api/salary', '/api/salary-structures', '/api/attendance', '/api/leave', '/api/payroll', '/api/payslips', '/api/payslips/pdf', '/api/accounts', '/api/journals', '/api/payroll-accounting', '/api/parties', '/api/invoices', '/api/banking', '/api/disbursements?month=2026-09-01', '/api/disbursements?month=2026-09-01&export=csv'];
for (const path of protectedPaths) {
  const response = await fetch(new URL(path, base), { redirect: 'manual' });
  assert.equal(response.status, 401, `${path} must deny anonymous access`);
  assert.equal((await response.json()).error.code, 'UNAUTHENTICATED');
  console.log(`PASS anonymous denial ${path}`);
}
const denied = await fetch(new URL('/api/auth/login', base), { method: 'POST', headers: { origin: 'https://untrusted.example.invalid', 'content-type': 'application/json' }, body: '{}' });
assert.equal(denied.status, 403);
assert.equal((await denied.json()).error.code, 'INVALID_ORIGIN');
console.log('PASS cross-origin mutation denied');
const page = await fetch(new URL('/dashboard', base), { redirect: 'manual' });
assert.equal(page.status, 307);
assert.equal(new URL(page.headers.get('location'), base).pathname, '/login');
console.log('PASS signed-out business page redirects to login');
console.log(`${protectedPaths.length + 2} HTTP smoke checks passed. No authenticated or persistent workflow is tested.`);
