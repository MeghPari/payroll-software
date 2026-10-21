"use client";
import {ClientEmployeeImportDialog} from './client-employee-import-dialog';
export function BulkUploadEmployeesDialog(props:{open:boolean;onOpenChange:(open:boolean)=>void;onImported:()=>void}){return <ClientEmployeeImportDialog {...props}/>;}
