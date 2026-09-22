"use client";

import { useState } from "react";
import { ChevronRight, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountGroup } from "@/types";

interface AccountTreeProps {
  groups: AccountGroup[];
  selectedId: string | null;
  onSelect: (group: AccountGroup) => void;
}

export function AccountTree({ groups, selectedId, onSelect }: AccountTreeProps) {
  return (
    <ul className="space-y-0.5">
      {groups.map((group) => (
        <TreeNode key={group.id} group={group} depth={0} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </ul>
  );
}

function TreeNode({
  group,
  depth,
  selectedId,
  onSelect,
}: {
  group: AccountGroup;
  depth: number;
  selectedId: string | null;
  onSelect: (group: AccountGroup) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = !!group.children?.length;

  return (
    <li>
      <button
        onClick={() => {
          onSelect(group);
          if (hasChildren) setOpen((o) => !o);
        }}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-[13px] transition-colors hover:bg-muted/60",
          selectedId === group.id ? "bg-accent text-accent-foreground font-medium" : "text-foreground"
        )}
      >
        {hasChildren ? (
          <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        ) : (
          <span className="w-3.5" />
        )}
        <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{group.name}</span>
      </button>
      {hasChildren && open && (
        <ul className="space-y-0.5">
          {group.children!.map((child) => (
            <TreeNode key={child.id} group={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}
