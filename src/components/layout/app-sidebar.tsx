"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, X } from "lucide-react";
import { navGroups } from "@/config/nav";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-white">
          <Wallet className="h-4.5 w-4.5" />
        </div>
        <span className="text-[17px] font-semibold tracking-tight text-white">PayFlow</span>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-6" aria-label="Primary navigation">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-3 pb-1.5 text-[10.5px] font-semibold tracking-wider text-sidebar-foreground/45">
              {group.label.toUpperCase()}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-primary text-white shadow-sm"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white"
                      )}
                    >
                      <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={2} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}

export function AppSidebar() {
  const mobileOpen = useAppStore((s) => s.mobileSidebarOpen);
  const setMobileOpen = useAppStore((s) => s.setMobileSidebarOpen);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[240px] lg:flex-col bg-sidebar border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-[260px] bg-sidebar shadow-xl">
            <div className="flex justify-end p-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-sidebar-accent hover:text-white"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
