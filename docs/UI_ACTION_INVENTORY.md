# Baseline UI action and data dependency inventory

Generated before backend implementation. Every source file was scanned; UI primitives without business handlers are omitted. Line numbers describe baseline source. This is an audit inventory, not a list of implemented endpoints.

## src/app/announcements/page.tsx

```text
50: <Button className="gap-1.5" onClick={() => toast.info("New Announcement — form coming soon")}>
```

## src/app/attendance/page.tsx

```text
55: import { departments } from "@/data/mock/employees";
56: import { today, monthKeyFromLabel, indianStates, useOperations } from "@/store/operations-store";
58: import { CURRENT_PAYROLL_MONTH } from "@/data/mock/attendance";
207: onClick={(e) => {
244: <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setMarkOpen(true)}>
251: onClick={() =>
335: toast.success(`Attendance finalized for ${month}`, { description: "Attendance is now locked for payroll processing." });
395: onClick={() => (finalized ? toast.info("Unlocking attendance requires Payroll Admin approval.") : setConfirmOpen(true))}
497: <Button size="sm" variant="outline" className="gap-1 text-success border-emerald-200 hover:bg-emerald-50" onClick={() => handleAction(leave.id, "Approved")}>
500: <Button size="sm" variant="outline" className="gap-1 text-danger border-rose-200 hover:bg-rose-50" onClick={() => handleAction(leave.id, "Rejected")}>
602: onClick={() => downloadCSV("attendance_import_template.csv", ATTENDANCE_IMPORT_COLUMNS, [])}
606: <Button className="gap-1.5" onClick={() => setOpen(true)}>
611: <BulkUploadAttendanceDialog open={open} onOpenChange={setOpen} onImported={() => toast.success("Attendance imported — check Today's Attendance / Register tabs.")} />
621: const [recent] = useState<UploadRecord[]>(() => useOperations.getState().uploads.filter((u) => u.kind === "Attendance"));
```

## src/app/chart-of-accounts/page.tsx

```text
75: <Button variant="outline" className="gap-1.5" onClick={() => toast.info("Import Chart — coming soon")}>
78: <Button variant="outline" className="gap-1.5" onClick={() => toast.info("Add Group — coming soon")}>
81: <Button className="gap-1.5" onClick={() => toast.info("Add Ledger — coming soon")}>
109: <button className="text-xs text-primary hover:underline" onClick={() => setSelectedGroup(null)}>
```

## src/app/customers/page.tsx

```text
53: <Button className="gap-1.5" onClick={() => toast.info("Add Customer — coming soon")}>
```

## src/app/dashboard/page.tsx

```text
37: import { CURRENT_PAYROLL_MONTH_KEY } from "@/data/mock/attendance";
```

## src/app/disbursement/page.tsx

```text
48: await new Promise((r) => setTimeout(r, 1500));
51: toast.success(`Disbursement initiated for ${pending} employees`);
82: <Button className="gap-1.5" onClick={() => setDisburseOpen(true)} disabled={pending === 0}>
```

## src/app/employees/[id]/attendance-panel.tsx

```text
10: import { useOperations, monthKeyFromLabel } from "@/store/operations-store";
12: import { CURRENT_PAYROLL_MONTH } from "@/data/mock/attendance";
33: const rows = useOperations
```

## src/app/employees/[id]/documents-panel.tsx

```text
26: toast.success(`${docName} uploaded`, { description: "Pending verification." });
37: toast.success(`${docName} verified`);
72: <Button variant="outline" size="sm" className="gap-1.5" disabled={busy === doc.name} onClick={() => fileInputs.current[doc.name]?.click()}>
76: <Button variant="outline" size="sm" className="gap-1.5 text-success border-emerald-200 hover:bg-emerald-50" disabled={busy === doc.name} onClick={() => handleVerify(doc.name)}>
```

## src/app/employees/[id]/kyc-panel.tsx

```text
30: <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs text-primary" onClick={onVerify}>
52: toast.success(`${label} updated`);
```

## src/app/employees/[id]/page.tsx

```text
18: import { CURRENT_PAYROLL_MONTH } from "@/data/mock/attendance";
73: <Button variant="ghost" size="sm" className="mb-3 gap-1.5 text-muted-foreground" onClick={() => router.push("/employees")}>
102: <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setStatusOpen(true)}>
106: <Button variant="outline" size="sm" className="gap-1.5 text-success border-emerald-200 hover:bg-emerald-50" onClick={() => setReleaseOpen(true)}>
110: <Button variant="outline" size="sm" className="gap-1.5 text-danger border-rose-200 hover:bg-rose-50" onClick={() => setHoldOpen(true)}>
```

## src/app/employees/[id]/salary-panel.tsx

```text
13: import { CURRENT_PAYROLL_MONTH } from "@/data/mock/attendance";
78: toast.success("Salary profile updated", { description: "A new salary revision has been recorded if the gross amount changed." });
144: <Button onClick={handleSave} disabled={saving} className="gap-1.5">
```

## src/app/employees/page.tsx

```text
58: import { departments, workLocations } from "@/data/mock/employees";
145: toast.success(`Updated ${ids.length} employee${ids.length === 1 ? "" : "s"}`);
153: toast.success(`${field === "pfApplicable" ? "PF" : "ESI"} ${value ? "enabled" : "disabled"} for ${ids.length} employee${ids.length === 1 ? "" : "s"}`);
193: { label: "View Profile", icon: <Eye className="h-4 w-4" />, onClick: () => router.push(`/employees/${row.original.id}`) },
194: { label: "Quick View", icon: <Eye className="h-4 w-4" />, onClick: () => openDrawer(row.original) },
195: { label: "Edit Employee", icon: <Pencil className="h-4 w-4" />, onClick: () => toast.info("Edit employee — coming soon") },
200: onClick: () => toast.error(`${row.original.fullName} removal requires confirmation`),
215: <Button variant="outline" className="gap-1.5" onClick={() => setBulkUploadOpen(true)}>
218: <Button className="gap-1.5" onClick={() => setAddOpen(true)}>
260: onClick={() => {
285: <DropdownMenuItem onClick={() => setBulkAction("department")}>
288: <DropdownMenuItem onClick={() => setBulkAction("location")}>
291: <DropdownMenuItem onClick={() => setBulkAction("state")}>
298: <DropdownMenuItem onClick={() => setPfConfirm(true)}>
301: <DropdownMenuItem onClick={() => setPfConfirm(false)}>
304: <DropdownMenuItem onClick={() => setEsiConfirm(true)}>
307: <DropdownMenuItem onClick={() => setEsiConfirm(false)}>
312: <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setSelectedIds(new Set())}>
```

## src/app/financial-reports/page.tsx

```text
52: toast.promise(generateReport(report.key), {
103: <Button variant="ghost" size="icon-sm" aria-label={`Download ${r.title}`} onClick={() => toast.info(`Downloading ${r.title}...`)}>
```

## src/app/journal-entries/page.tsx

```text
52: <Button className="gap-1.5" onClick={() => toast.info("New Voucher — coming soon")}>
```

## src/app/ledgers/page.tsx

```text
59: <Button className="gap-1.5" onClick={() => toast.info("Add Ledger — coming soon")}>
```

## src/app/payroll-reports/page.tsx

```text
32: onView={() => toast.promise(new Promise((res) => setTimeout(res, 900)), { loading: `Generating ${r.title}...`, success: `${r.title} is ready.`, error: "Failed to generate report." })}
```

## src/app/payroll/page.tsx

```text
51: import { CURRENT_PAYROLL_MONTH } from "@/data/mock/attendance";
156: toast.success(`Attendance finalized for ${month}`);
170: toast.error(`Validation found ${summary.blockingErrors} blocking error(s)`);
172: toast.success("Validation passed", { description: `${summary.passed} checks passed, ${summary.warnings} warning(s).` });
184: toast.success(`Payroll approved for ${month}`);
196: toast.success(`Payroll locked for ${month}`, { description: "Payslips and disbursement can now proceed." });
206: toast.info("Payroll unlocked for editing");
278: <Button variant="outline" size="sm" className="gap-1.5" onClick={handleUnlock}>
296: <Button size="sm" className="gap-1.5" onClick={() => setFinalizeConfirm(true)} disabled={busy === "finalize"}>
304: <Button size="sm" variant="outline" className="gap-1.5" onClick={handleValidate} disabled={validating}>
323: onClick={() => setIssuesExpanded((v) => !v)}
410: <Button variant="outline" size="sm" className="gap-1.5" onClick={refresh} disabled={loading}>
420: <Button variant="outline" size="lg" className="gap-1.5" disabled={isLocked || !!period?.approved} onClick={() => setApproveConfirm(true)}>
423: <Button size="lg" className="gap-1.5" disabled={isLocked || !period?.approved} onClick={() => setLockConfirm(true)}>
```

## src/app/payslips/page.tsx

```text
21: import { departments } from "@/data/mock/employees";
80: toast.success(`Payslips published to ${pendingIds.length} employees`);
87: toast.success(count > 0 ? `${count} failed payslips reprocessed` : "No failed payslips to reprocess");
111: <Button variant="ghost" size="icon-sm" aria-label="Download payslip PDF" onClick={(e) => { e.stopPropagation(); toast.info("Downloading payslip PDF..."); }}>
177: { icon: FileDown, label: "Bulk Download Payslips", description: "Download payslips as PDF (ZIP)", onClick: () => toast.info("Preparing ZIP download...") },
178: { icon: Send, label: "Publish Payslips", description: "Publish payslips to employee app", onClick: () => setPublishOpen(true) },
179: { icon: Mail, label: "Send Payslips by Email", description: "Email payslips to employees", onClick: () => toast.info("Queued payslip emails") },
180: { icon: BellRing, label: "Notify Employees", description: "Send in-app notification", onClick: () => toast.success("Employees notified") },
181: { icon: RotateCcw, label: "Reprocess Failed", description: "Retry failed payslip generation", onClick: handleReprocess },
```

## src/app/purchase-invoices/page.tsx

```text
51: <Button className="gap-1.5" onClick={() => toast.info("Record Purchase Invoice — coming soon")}>
```

## src/app/salary-structures/page.tsx

```text
24: import { useOperations, grossOf } from "@/store/operations-store";
68: const salaries = useOperations.getState().salaries;
88: <Button variant="outline" className="gap-1.5" onClick={() => setBulkUploadOpen(true)}>
91: <Button className="gap-1.5" onClick={() => toast.info("Create Structure — form coming soon")}>
124: onClick={() => setSelectedId(s.id)}
159: <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Assign to Employees — coming soon")}>
162: <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Preview Salary Slip — coming soon")}>
170: <DropdownMenuItem onClick={() => toast.info("Edit structure — coming soon")}>
173: <DropdownMenuItem onClick={() => toast.info("Structure duplicated")}>
185: onAdd={() => toast.info("Add Earning — coming soon")}
191: onAdd={() => toast.info("Add Deduction — coming soon")}
238: <Button className="gap-1.5" onClick={() => toast.success("Salary structure saved")}>
342: <Button variant="outline" size="sm" className="mt-2.5 gap-1.5" onClick={onAdd}>
```

## src/app/sales-invoices/page.tsx

```text
35: if (searchParams.get("create") === "1") toast.info("Create Invoice — form coming soon");
65: <Button className="gap-1.5" onClick={() => toast.info("Create Invoice — form coming soon")}>
```

## src/app/settings/page.tsx

```text
54: toast.success(`${section} saved`);
97: <Button onClick={() => toast.success("Company profile updated")}>Save Changes</Button>
169: <Button onClick={() => saveConfig("Salary proration settings")}>Save Changes</Button>
227: <Button onClick={() => saveConfig("Statutory configuration")}>Save PF / ESI Configuration</Button>
288: <Button onClick={() => saveConfig("Tax configuration")}>Save Tax Configuration</Button>
```

## src/app/support/page.tsx

```text
55: onSubmit={(e) => {
57: toast.success("Support ticket submitted", { description: "Our team will get back to you within 24 hours." });
```

## src/app/user-roles/page.tsx

```text
12: import { useOperations } from "@/store/operations-store";
34: const activeRole = useOperations((s) => s.role);
35: const setRole = useOperations((s) => s.setRole);
44: <Button className="gap-1.5" onClick={() => toast.info("Create Role — form coming soon")}>
68: onClick={() => {
70: toast.success(`Active role switched to ${pendingRole}`);
```

## src/app/vendors/page.tsx

```text
50: <Button className="gap-1.5" onClick={() => toast.info("Add Vendor — coming soon")}>
```

## src/components/attendance/mark-edit-attendance-dialog.tsx

```text
58: toast.error("Reason for manual change is required.");
78: toast.success(`Attendance ${existingRecord ? "updated" : "marked"} for ${employee.fullName}`);
177: <Button variant="outline" onClick={() => onOpenChange(false)}>
180: <Button onClick={handleSave} disabled={submitting}>
```

## src/components/employees/add-employee-dialog.tsx

```text
22: import { departments } from "@/data/mock/employees";
85: const timeout = setTimeout(() => runUanCheck(uan ?? ""), 400);
89: async function onSubmit(values: FormValues) {
91: toast.error("Cannot add employee with a duplicate UAN", { description: "Resolve the UAN conflict before continuing." });
126: toast.success("Employee added", {
148: <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
303: <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
```

## src/components/employees/bulk-action-dialog.tsx

```text
63: <Button variant="outline" onClick={() => onOpenChange(false)}>
66: <Button onClick={handleApply} disabled={submitting || !value.trim()}>
```

## src/components/employees/change-status-dialog.tsx

```text
62: toast.success(`${employee.fullName}'s status updated to ${status}`);
168: <Button variant="outline" onClick={() => onOpenChange(false)}>
171: <Button onClick={handleSubmit} disabled={submitting}>
```

## src/components/employees/employee-detail-drawer.tsx

```text
129: <Button className="flex-1 gap-1.5" onClick={() => { onOpenChange(false); router.push(`/employees/${employee.id}`); }}>
```

## src/components/employees/salary-hold-dialog.tsx

```text
35: toast.success(`Salary put on hold for ${employeeName}`, { description: `${month} · ${reason}` });
91: <Button variant="outline" onClick={() => onOpenChange(false)}>
94: <Button onClick={handleConfirm} disabled={submitting} className="bg-danger text-white hover:bg-danger/90">
121: toast.success(`Salary released for ${employeeName}`);
158: <Button variant="outline" onClick={() => onOpenChange(false)}>
161: <Button onClick={handleConfirm} disabled={submitting}>
```

## src/components/layout/app-sidebar.tsx

```text
37: onClick={onNavigate}
76: onClick={() => setMobileOpen(false)}
85: onClick={() => setMobileOpen(false)}
```

## src/components/layout/top-header.tsx

```text
30: onClick={() => setMobileOpen(true)}
58: <DropdownMenuItem onClick={() => router.push("/employees?add=1")}>
61: <DropdownMenuItem onClick={() => router.push("/payroll")}>
64: <DropdownMenuItem onClick={() => router.push("/sales-invoices?create=1")}>
67: <DropdownMenuItem onClick={() => router.push("/payslips")}>
```

## src/components/shared/account-tree.tsx

```text
41: onClick={() => {
```

## src/components/shared/bulk-upload-dialog.tsx

```text
100: await new Promise((r) => setTimeout(r, 600));
109: toast.error("Could not read the file", { description: "Please check the file format and try again." });
131: toast.success("Import completed", { description: `${validRows.length} records imported successfully.` });
191: onClick={() => {
193: toast.success("Template downloaded");
199: <Button onClick={() => setStep("upload")}>Continue to Upload</Button>
215: onClick={() => inputRef.current?.click()}
301: <Button variant="outline" onClick={() => setStep("upload")}>
304: <Button disabled={results.length === 0 || readyToImport === 0} onClick={() => setStep("summary")}>
326: <Button variant="outline" onClick={() => setStep("preview")}>
329: <Button disabled={readyToImport === 0 || importing} onClick={handleImport} className="gap-1.5">
347: <Button onClick={() => handleOpenChange(false)} className="gap-1.5">
```

## src/components/shared/company-selector.tsx

```text
26: <DropdownMenuItem key={c.id} onClick={() => setCompanyId(c.id)}>
```

## src/components/shared/confirm-dialog.tsx

```text
48: onClick={(e) => {
```

## src/components/shared/data-table.tsx

```text
149: onClick={canSort ? () => toggleSort(colId) : undefined}
169: <TableRow key={rowIndex} className={cn(onRowClick && "cursor-pointer")} onClick={() => onRowClick?.(row)}>
171: <TableCell onClick={(e) => e.stopPropagation()}>
```

## src/components/shared/month-picker.tsx

```text
25: <DropdownMenuItem key={m} onClick={() => setMonth(m)}>
```

## src/components/shared/pagination.tsx

```text
34: onClick={() => onPageChange(page - 1)}
50: onClick={() => onPageChange(p as number)}
62: onClick={() => onPageChange(page + 1)}
```

## src/components/shared/quick-actions-card.tsx

```text
8: onClick: () => void;
22: onClick={action.onClick}
```

## src/components/shared/report-card.tsx

```text
31: <Button variant="outline" size="sm" className="mt-4 w-fit" onClick={onView}>
```

## src/components/shared/table-action-menu.tsx

```text
16: onClick: () => void;
30: onClick={(e) => e.stopPropagation()}
36: <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
40: onClick={action.onClick}
```

## src/lib/async.ts

```text
4: export function mockDelay<T>(value: T, ms: number = MOCK_LATENCY_MS): Promise<T> {
5: return new Promise((resolve) => setTimeout(() => resolve(value), ms));
```

## src/services/accounting.service.ts

```text
1: import { accountGroups, ledgers as mockLedgers } from "@/data/mock/chartOfAccounts";
12: } from "@/data/mock/accounting";
13: import { dashboardKpis, accountsSummary, payrollSummary } from "@/data/mock/dashboard";
14: import { mockDelay } from "@/lib/async";
18: return mockDelay({
42: return mockDelay({ groups: accountGroups, ledgers: mockLedgers });
47: return mockDelay(mockLedgers);
52: return mockDelay(customers);
57: return mockDelay(vendors);
62: return mockDelay(recentInvoices);
67: return mockDelay(purchaseInvoices);
72: return mockDelay(recentVouchers);
77: return mockDelay(gstSummary);
82: return mockDelay(cashFlowHistory);
87: return mockDelay(topExpenses);
```

## src/services/attendance.service.ts

```text
1: import { attendanceRecords, attendanceSummary, CURRENT_PAYROLL_MONTH_KEY } from "@/data/mock/attendance";
2: import { leaveRequests as mockLeaveRequests, leaveBalances, uploadHistory } from "@/data/mock/leaves";
3: import { mockDelay } from "@/lib/async";
4: import { attendanceStatuses, attendanceSummaryFor, today, useOperations } from "@/store/operations-store";
21: return mockDelay(attendanceRecords.filter((r) => r.month === month));
26: return mockDelay(attendanceSummary);
31: return mockDelay([...leaveStore]);
37: if (index === -1) return mockDelay(undefined);
39: return mockDelay(leaveStore[index]);
44: return mockDelay(leaveBalances);
49: return mockDelay(uploadHistory);
58: return mockDelay(useOperations.getState().attendance.filter((a) => a.date === date));
74: const records = useOperations.getState().attendance.filter((a) => a.date === date);
75: const total = useOperations.getState().employees.length;
83: return mockDelay({ total, present, absent, onLeave, halfDay, weeklyOff, late, missingPunch });
96: useOperations.getState().upsertAttendance(record, reason);
97: return mockDelay(record, 700);
102: const entries = useOperations.getState().audit.filter((a) => a.action === "Attendance Modified" && (!employeeId || a.employeeId === employeeId));
103: return mockDelay(entries);
108: useOperations.getState().finalizeAttendance(month);
109: return mockDelay(undefined, 1000);
114: return mockDelay(useOperations.getState().finalizedMonths.includes(month));
119: return mockDelay(attendanceSummaryFor(employeeId, month));
129: const employees = useOperations.getState().employees;
130: return mockDelay(employees.map((e) => ({ employeeId: e.id, summary: attendanceSummaryFor(e.id, month) })));
169: const state = useOperations.getState();
213: return mockDelay(results, 900);
218: const state = useOperations.getState();
243: return mockDelay(record, 1200);
```

## src/services/audit.service.ts

```text
1: import { mockDelay } from "@/lib/async";
2: import { useOperations } from "@/store/operations-store";
13: let results = [...useOperations.getState().audit];
22: return mockDelay(results);
```

## src/services/dashboard.service.ts

```text
1: import { dashboardKpis, payrollSummary, accountsSummary, pendingActions, payrollCostHistory, cashFlowHistory, topExpenses } from "@/data/mock/dashboard";
2: import { mockDelay } from "@/lib/async";
6: return mockDelay({
```

## src/services/employee.service.ts

```text
1: import { mockDelay } from "@/lib/async";
2: import { useOperations, checkDuplicateUAN as checkDuplicateUANInStore } from "@/store/operations-store";
10: const count = useOperations.getState().employees.length;
17: let results = [...useOperations.getState().employees];
32: return mockDelay(results);
37: return mockDelay(useOperations.getState().employees.find((e) => e.id === id));
44: useOperations.getState().addEmployee(newEmployee);
45: return mockDelay(newEmployee, 700);
50: useOperations.getState().updateEmployeeRecord(id, data);
51: return mockDelay(useOperations.getState().employees.find((e) => e.id === id));
56: const exists = useOperations.getState().employees.some((e) => e.id === id);
57: if (!exists) return mockDelay(false);
58: useOperations.getState().removeEmployee(id);
59: return mockDelay(true);
69: return mockDelay(checkDuplicateUANInStore(uan, excludeEmployeeId), 300);
86: useOperations.getState().updateEmployeeStatus(employeeId, payload);
87: return mockDelay(undefined, 700);
92: return mockDelay(useOperations.getState().statusHistory.filter((s) => s.employeeId === employeeId));
97: return mockDelay(useOperations.getState().exits[employeeId]);
165: const existingIds = new Set(useOperations.getState().employees.map((e) => e.employeeCode));
199: return mockDelay(results, 900);
204: const state = useOperations.getState();
242: return mockDelay(record, 1200);
251: useOperations.getState().bulkAssign(employeeIds, { salaryStructureId }, "Bulk Assign Salary Structure");
252: return mockDelay(undefined, 700);
257: useOperations.getState().bulkAssign(employeeIds, { department }, "Bulk Change Department");
258: return mockDelay(undefined, 700);
263: useOperations.getState().bulkAssign(employeeIds, { workLocation }, "Bulk Set Work Location");
264: return mockDelay(undefined, 700);
269: useOperations.getState().bulkAssign(employeeIds, { state }, "Bulk Update State");
270: return mockDelay(undefined, 700);
275: const ops = useOperations.getState();
278: return mockDelay(undefined, 700);
```

## src/services/kyc.service.ts

```text
1: import { mockDelay } from "@/lib/async";
2: import { useOperations } from "@/store/operations-store";
7: return mockDelay(useOperations.getState().kyc[employeeId]);
12: useOperations.getState().updateKYC(employeeId, data);
13: return mockDelay(useOperations.getState().kyc[employeeId], 700);
18: useOperations.getState().uploadDocument(employeeId, docName, fileName);
19: return mockDelay(undefined, 900);
24: useOperations.getState().verifyDocument(employeeId, docName);
25: return mockDelay(undefined, 600);
```

## src/services/payroll.service.ts

```text
1: import { payrollRun as mockPayrollRun, payrollCostHistory } from "@/data/mock/payroll";
2: import { salaryStructures as mockStructures } from "@/data/mock/salaryStructures";
3: import { mockDelay } from "@/lib/async";
9: useOperations,
29: return mockDelay({ ...runState, month });
34: return mockDelay({ passed: runState.validationPassed, alerts: runState.alerts }, 900);
39: return mockDelay({ ...runState }, 1200);
48: return mockDelay({ ...runState }, 1400);
54: return mockDelay({ ...runState });
59: return mockDelay(payrollCostHistory);
64: return mockDelay([...structureStore]);
69: return mockDelay(structureStore.find((s) => s.id === id));
75: if (index === -1) return mockDelay(undefined);
77: return mockDelay(structureStore[index]);
84: return mockDelay(newStructure);
93: return mockDelay(calculatePayrollRow(employeeId, month));
98: return mockDelay(calculatePayrollForMonth(month), 1000);
112: const totalChecked = useOperations.getState().employees.length;
116: useOperations.getState().validatePeriod(month);
117: return mockDelay({ issues, totalChecked, passed, warnings, blockingErrors }, 1100);
122: return mockDelay(payrollExceptionsForMonth(month));
127: return mockDelay(payrollExceptionCountsForMonth(month));
137: return mockDelay(counts);
142: return mockDelay(useOperations.getState().ensurePeriod(month));
147: useOperations.getState().approvePeriod(month);
148: return mockDelay(useOperations.getState().periods[month], 1400);
153: useOperations.getState().lockPeriod(month);
154: return mockDelay(useOperations.getState().periods[month], 900);
159: useOperations.getState().unlockPeriod(month);
160: return mockDelay(useOperations.getState().periods[month], 500);
```

## src/services/payslip.service.ts

```text
1: import { payslips as mockPayslips } from "@/data/mock/payslips";
2: import { mockDelay } from "@/lib/async";
9: return mockDelay(month ? store.filter((p) => p.month === month) : [...store]);
14: return mockDelay(store.find((p) => p.id === id));
25: return mockDelay(store.filter((p) => ids.includes(p.id)), 1200);
37: return mockDelay(count, 1500);
```

## src/services/report.service.ts

```text
1: import { financialReportCards, recentReports } from "@/data/mock/financialReports";
2: import { mockDelay } from "@/lib/async";
6: return mockDelay(financialReportCards);
11: return mockDelay(recentReports);
16: return mockDelay({ success: true, reportKey }, 1000);
```

## src/services/salary.service.ts

```text
1: import { mockDelay } from "@/lib/async";
2: import { grossOf, useOperations, activeHoldFor } from "@/store/operations-store";
7: return mockDelay(useOperations.getState().salaries[employeeId]);
12: useOperations.getState().updateSalaryProfile(employeeId, profile);
13: return mockDelay(profile, 800);
18: const all = useOperations.getState().revisions;
19: return mockDelay(employeeId ? all.filter((r) => r.employeeId === employeeId) : all);
28: useOperations.getState().holdSalary(employeeId, month, reason, remarks);
29: return mockDelay(undefined, 700);
34: useOperations.getState().releaseSalary(employeeId, month, remarks);
35: return mockDelay(undefined, 700);
40: const all = useOperations.getState().holds;
41: return mockDelay(employeeId ? all.filter((h) => h.employeeId === employeeId) : all);
90: const state = useOperations.getState();
134: return mockDelay(results, 900);
139: const state = useOperations.getState();
164: return mockDelay(record, 1200);
```

## src/services/statutory.service.ts

```text
1: import { mockDelay } from "@/lib/async";
2: import { indianStates, useOperations } from "@/store/operations-store";
7: return mockDelay(useOperations.getState().config);
12: useOperations.getState().updateConfig(patch);
13: return mockDelay(useOperations.getState().config, 700);
18: return mockDelay(useOperations.getState().config.states);
23: useOperations.getState().updateStatePT(state, professionalTax);
24: return mockDelay(undefined, 500);
```

## src/store/operations-store.ts

```text
2: import { employees as seedEmployees } from "@/data/mock/employees";
3: import { CURRENT_PAYROLL_MONTH_KEY } from "@/data/mock/attendance";
325: export const useOperations = create<OperationsState>((set, get) => ({
663: const { attendance, config } = useOperations.getState();
685: const { config } = useOperations.getState();
692: return daysInMonth(month) - useOperations.getState().attendance.filter((a) => a.date.startsWith(month) && a.status === "Weekly Off").length / 4;
707: return useOperations.getState().employees.find((e) => e.id !== excludeEmployeeId && e.statutory.uan && e.statutory.uan.replace(/\s/g, "") === uan.replace(/\s/g, ""));
711: return useOperations.getState().holds.find((h) => h.employeeId === employeeId && h.month === month && h.status === "Held");
715: const state = useOperations.getState();
804: const employees = useOperations.getState().employees;
809: const state = useOperations.getState();
840: const employees = useOperations.getState().employees;
845: const state = useOperations.getState();
```
