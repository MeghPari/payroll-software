"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "./app-sidebar";
import { TopHeader } from "./top-header";

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  if (path === "/login") {
    return <main className="flex min-h-screen items-center justify-center px-4 py-8">{children}</main>;
  }
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
