"use client";

import { useEffect, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { Button } from "@/components/ui/button";
import { roles as roleNames } from "@/config/permissions";
import { useSessionStore } from "@/store/session-store";
import { tenantApi, permitted } from "@/lib/tenant-api";
import { MemberDialog, type CompanyMember } from "@/components/admin/member-dialog";



export default function UserRolesPage() {
  const companyId=useSessionStore(state=>state.companyId);
  return <UserRolesContent key={companyId}/>;
}
function UserRolesContent() {
  const session=useSessionStore(state=>state.session);
  const [members,setMembers]=useState<CompanyMember[]>([]),[editing,setEditing]=useState<CompanyMember|null|undefined>(undefined),[error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  useEffect(()=>{let cancelled=false;tenantApi<CompanyMember[]>('users').then(members=>{if(!cancelled){setMembers(members);setError('');}}).catch(error=>{if(!cancelled)setError(error instanceof Error?error.message:'Unable to load users.');});return()=>{cancelled=true;};},[revision]);
  const permissions=Object.fromEntries(roleNames.map(role=>[role,session?.permissions.filter(row=>row.role===role).map(row=>row.permission)??[]]));
  const allModules=Array.from(new Set(Object.values(permissions).flat())).sort();
  const roles=roleNames.map(role=>({id:role,name:role,description:'Database-enforced permissions for '+role+'.',users:members.filter(member=>member.active&&member.role===role).length,permissions:permissions[role]}));
  const users=members.map(member=>({id:member.user_id,name:member.user_id===session?.user.id?'Your account':member.user_id,email:member.user_id===session?.user.id?session.user.email:member.user_id,role:member.role,status:member.active?'Active':'Inactive'}));
  return (
    <div>
      <PageHeader
        title="User Roles"
        subtitle="Define roles and manage user access across the platform."
        actions={
          <Button className="gap-1.5" disabled={!permitted("users.manage")} onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" /> Assign User
          </Button>
        }
      />

      {error&&<p role="alert" className="mb-4 rounded-xl border p-4 text-sm text-danger">{error}</p>}
      <MemberDialog member={editing} onClose={()=>setEditing(undefined)} onSaved={()=>setRevision(value=>value+1)}/>
      <SectionCard title="Permission Matrix" subtitle="Centralized module access per role." className="mb-5" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Module</th>
                {roleNames.map((r) => (
                  <th key={r} className="px-3 py-2.5 text-center">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allModules.map((module) => (
                <tr key={module}>
                  <td className="px-4 py-2 text-muted-foreground">{module}</td>
                  {roleNames.map((r) => (
                    <td key={r} className="px-3 py-2 text-center">
                      {permissions[r].includes(module) ? <span className="text-success">●</span> : <span className="text-muted-foreground/30">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {roles.map((r) => (
          <SectionCard key={r.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-purple">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{r.name}</h3>
                  <p className="text-xs text-muted-foreground">{r.users} users</p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{r.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {r.permissions.map((p) => (
                <span key={p} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {p}
                </span>
              ))}
            </div>
          </SectionCard>
        ))}
      </div>

      <SectionCard title="Users" subtitle="Assigned roles for platform users" className="mt-5" noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">User</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <EmployeeAvatar name={u.name} size="sm" />
                      <div>
                        <p className="font-medium text-foreground">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{u.role}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.status} />
                  </td><td className="px-4 py-3"><Button size="sm" variant="outline" disabled={!permitted("users.manage")} onClick={()=>setEditing(members.find(member=>member.user_id===u.id))}>Edit Access</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
