'use client';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { downloadCSV } from '@/lib/csv';
import type { ReportTable } from '@/domain/accounting-reports';
export function ReportPreview({report,onClose}:{report:ReportTable|null;onClose:()=>void}){
 return <Dialog open={!!report} onOpenChange={open=>!open&&onClose()}><DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-auto"><DialogHeader><DialogTitle>{report?.title} — {report?.month}</DialogTitle></DialogHeader>{report&&<><p className="text-xs text-muted-foreground">{report.note}</p><div className="max-h-[55vh] overflow-auto"><table className="w-full text-sm"><thead><tr>{report.headers.map(header=><th className="border-b p-2 text-left" key={header}>{header}</th>)}</tr></thead><tbody>{report.rows.map((row,index)=><tr key={index}>{row.map((value,column)=><td className="border-b p-2" key={column}>{value}</td>)}</tr>)}</tbody></table>{!report.rows.length&&<p className="p-4 text-sm text-muted-foreground">No posted records for the selected period.</p>}</div><DialogFooter><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={()=>downloadCSV(`${report.title}-${report.month}.csv`,report.headers,report.rows)}>Download CSV</Button></DialogFooter></>}</DialogContent></Dialog>;
}
