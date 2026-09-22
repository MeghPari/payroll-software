import type { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { TopHeader } from "./top-header";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="lg:pl-[240px]">
        <TopHeader />
        <main className="px-4 py-5 lg:px-7 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
