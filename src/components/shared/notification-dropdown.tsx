"use client";

import { Bell, CalendarClock, FileWarning, UserPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const notifications = [
  {
    id: "n1",
    icon: CalendarClock,
    title: "2 leave requests pending approval",
    time: "10 minutes ago",
    tone: "text-warning",
  },
  {
    id: "n2",
    icon: FileWarning,
    title: "Payroll validation found 2 critical alerts",
    time: "1 hour ago",
    tone: "text-danger",
  },
  {
    id: "n3",
    icon: UserPlus,
    title: "3 new employees added this week",
    time: "Yesterday",
    tone: "text-primary",
  },
];

export function NotificationDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="relative" aria-label="Notifications" />}
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-white">
          {notifications.length}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.map((n) => {
          const Icon = n.icon;
          return (
            <DropdownMenuItem key={n.id} className="items-start gap-2.5 py-2.5">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${n.tone}`} />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm leading-snug text-foreground">{n.title}</span>
                <span className="text-xs text-muted-foreground">{n.time}</span>
              </div>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="justify-center text-sm font-medium text-primary">
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
