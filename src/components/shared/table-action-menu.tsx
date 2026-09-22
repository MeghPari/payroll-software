"use client";

import { MoreVertical } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface TableAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

export function TableActionMenu({ actions }: { actions: TableAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Row actions"
            onClick={(e) => e.stopPropagation()}
          />
        }
      >
        <MoreVertical className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            onClick={action.onClick}
            className={action.destructive ? "text-danger focus:text-danger" : ""}
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
