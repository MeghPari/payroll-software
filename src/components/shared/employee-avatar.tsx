import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/utils/format";
import { cn } from "@/lib/utils";

const palette = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % palette.length;
  return palette[hash];
}

interface EmployeeAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-16 w-16 text-lg" };

export function EmployeeAvatar({ name, size = "md", className }: EmployeeAvatarProps) {
  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarFallback className={cn("font-semibold", colorFor(name))}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
