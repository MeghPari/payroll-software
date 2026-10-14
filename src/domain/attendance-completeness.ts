export function employmentDates(month: string, joiningDate: string, exitDate: string | null): string[] {
  const cursor = new Date(`${month}-01T00:00:00Z`);
  const dates: string[] = [];
  while (cursor.toISOString().startsWith(month)) {
    const date = cursor.toISOString().slice(0, 10);
    if (date >= joiningDate && (!exitDate || date <= exitDate)) dates.push(date);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function missingAttendanceDates(month: string, joiningDate: string, exitDate: string | null, records: { date: string; status: string }[]): string[] {
  const completed = new Set(records.filter(row => row.status !== 'Missing Punch').map(row => row.date));
  return employmentDates(month, joiningDate, exitDate).filter(date => !completed.has(date));
}
