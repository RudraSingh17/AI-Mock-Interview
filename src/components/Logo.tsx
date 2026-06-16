import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export function Logo({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 group">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-hero rounded-lg blur opacity-60 group-hover:opacity-100 transition-opacity" />
        <div className="relative flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-hero text-primary-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
      </div>
      <span className="text-lg font-semibold tracking-tight">
        AI Mock <span className="text-gradient">Interview</span>
      </span>
    </Link>
  );
}
