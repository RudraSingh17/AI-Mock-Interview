import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Sparkles, Calendar, ChevronRight, FileText } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <AppShell>
      <Dashboard />
    </AppShell>
  ),
});

interface InterviewRow {
  id: string;
  role: string;
  status: string;
  created_at: string;
  feedback: { overall_score?: number } | null;
}

function Dashboard() {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("interviews")
      .select("id, role, status, created_at, feedback")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setInterviews((data ?? []) as InterviewRow[]);
        setLoading(false);
      });
  }, [user]);

  const completed = interviews.filter((i) => i.status === "completed");
  const avgScore = completed.length
    ? Math.round(
        completed.reduce((acc, i) => acc + (i.feedback?.overall_score ?? 0), 0) / completed.length,
      )
    : null;

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">
            Ready for another round?
          </h1>
        </div>
        <Button size="lg" asChild className="shadow-premium">
          <Link to="/create">
            <Plus className="h-4 w-4 mr-2" />
            Create interview
          </Link>
        </Button>
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total interviews" value={interviews.length.toString()} icon={FileText} />
        <StatCard label="Completed" value={completed.length.toString()} icon={Sparkles} />
        <StatCard
          label="Average score"
          value={avgScore !== null ? `${avgScore}/100` : "—"}
          icon={Calendar}
        />
      </div>

      <div className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Recent interviews</h2>
        {loading ? (
          <Card className="p-10 text-center text-muted-foreground">Loading…</Card>
        ) : interviews.length === 0 ? (
          <Card className="p-10 text-center bg-gradient-card border-border/60">
            <Sparkles className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="font-semibold">No interviews yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-5 max-w-sm mx-auto">
              Upload your resume and start your first AI mock interview in under a minute.
            </p>
            <Button asChild>
              <Link to="/create">
                <Plus className="h-4 w-4 mr-2" />
                Create your first interview
              </Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {interviews.map((iv) => (
              <InterviewItem key={iv.id} iv={iv} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="p-5 bg-gradient-card border-border/60">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="text-3xl font-bold mt-2 tracking-tight">{value}</p>
    </Card>
  );
}

function InterviewItem({ iv }: { iv: InterviewRow }) {
  const date = new Date(iv.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const isDone = iv.status === "completed";
  const targetUrl = isDone ? `/results/${iv.id}` : `/interview/${iv.id}`;

  return (
    <Link
      to={targetUrl}
      className="block group"
    >
      <Card className="p-5 hover:shadow-premium transition-all hover:border-primary/40">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{iv.role}</h3>
              <Badge variant={isDone ? "default" : "secondary"}>
                {iv.status === "completed" ? "Completed" : iv.status === "in_progress" ? "In progress" : "Ready"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{date}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {isDone && iv.feedback?.overall_score !== undefined && (
              <span className="text-2xl font-bold text-gradient">
                {iv.feedback.overall_score}
                <span className="text-xs text-muted-foreground font-normal">/100</span>
              </span>
            )}
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
