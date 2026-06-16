import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import {
  Loader2,
  ArrowLeft,
  TrendingUp,
  Sparkles,
  Award,
  AlertCircle,
  Lightbulb,
  ChevronDown,
  Plus,
  Download,
} from "lucide-react";
import { downloadReportPdf } from "@/lib/report-pdf";

export const Route = createFileRoute("/results/$id")({
  component: () => (
    <AppShell>
      <Results />
    </AppShell>
  ),
});

interface Feedback {
  overall_score: number;
  summary: string;
  communication_score: number;
  technical_score: number;
  confidence_score: number;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  per_question: {
    question: string;
    answer: string;
    score: number;
    tip: string;
    improved_answer: string;
  }[];
}

function Results() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("interviews")
      .select("role, feedback, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error("Results not found");
          navigate({ to: "/dashboard" });
          return;
        }
        if (!data.feedback) {
          toast.error("This interview hasn't been completed.");
          navigate({ to: `/interview/${id}` });
          return;
        }
        setRole(data.role);
        setFeedback(data.feedback as unknown as Feedback);
        setLoading(false);
      });
  }, [id, user, navigate]);

  if (loading || !feedback) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
      </div>
    );
  }

  const grade = (s: number) =>
    s >= 80 ? "Excellent" : s >= 65 ? "Good" : s >= 50 ? "Fair" : "Needs work";
  const gradeColor = (s: number) =>
    s >= 80 ? "text-success" : s >= 65 ? "text-primary" : s >= 50 ? "text-warning" : "text-destructive";

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <Link to="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to dashboard
      </Link>

      {/* Hero score */}
      <Card className="p-8 md:p-10 bg-gradient-hero text-primary-foreground border-0 shadow-premium overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-glow opacity-50" />
        <div className="relative grid md:grid-cols-[auto_1fr] gap-8 items-center">
          <div className="text-center md:text-left">
            <p className="text-sm opacity-80 uppercase tracking-wider">Overall score</p>
            <div className="flex items-baseline gap-1 justify-center md:justify-start mt-1">
              <span className="text-7xl font-bold tracking-tight">{feedback.overall_score}</span>
              <span className="text-2xl opacity-80">/100</span>
            </div>
            <Badge className="mt-3 bg-white/20 hover:bg-white/30 text-white border-0">
              {grade(feedback.overall_score)}
            </Badge>
          </div>
          <div>
            <p className="text-sm opacity-80 uppercase tracking-wider">{role}</p>
            <h1 className="text-2xl md:text-3xl font-bold mt-1">Your interview report</h1>
            <p className="mt-3 text-sm md:text-base opacity-95 leading-relaxed">{feedback.summary}</p>
          </div>
        </div>
      </Card>

      {/* Sub-scores */}
      <div className="grid sm:grid-cols-3 gap-4 mt-6">
        <SubScore label="Communication" score={feedback.communication_score} grade={grade} color={gradeColor} />
        <SubScore label="Technical depth" score={feedback.technical_score} grade={grade} color={gradeColor} />
        <SubScore label="Confidence" score={feedback.confidence_score} grade={grade} color={gradeColor} />
      </div>

      {/* Strengths & weaknesses */}
      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <FeedbackList
          title="Strengths"
          icon={Award}
          tone="success"
          items={feedback.strengths}
        />
        <FeedbackList
          title="Areas to improve"
          icon={AlertCircle}
          tone="warning"
          items={feedback.weaknesses}
        />
      </div>

      {/* Suggestions */}
      <Card className="p-6 mt-6 bg-gradient-card border-border/60">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Suggestions to enhance your interviews</h2>
        </div>
        <ul className="space-y-3">
          {feedback.improvements.map((tip, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="h-6 w-6 shrink-0 rounded-full bg-gradient-hero text-primary-foreground text-xs flex items-center justify-center font-semibold">
                {i + 1}
              </div>
              <p className="text-sm leading-relaxed pt-0.5">{tip}</p>
            </li>
          ))}
        </ul>
      </Card>

      {/* Per-question */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Question-by-question review</h2>
        </div>
        <div className="space-y-3">
          {feedback.per_question.map((pq, i) => {
            const open = openIdx === i;
            return (
              <Card key={i} className="overflow-hidden border-border/60">
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  className="w-full text-left p-5 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Question {i + 1}</p>
                      <p className="font-medium mt-1 line-clamp-2">{pq.question}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xl font-bold ${gradeColor(pq.score * 10)}`}>
                        {pq.score}
                        <span className="text-xs text-muted-foreground font-normal">/10</span>
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                      />
                    </div>
                  </div>
                </button>
                {open && (
                  <div className="px-5 pb-5 space-y-4 border-t border-border/60 pt-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                        Your answer
                      </p>
                      <p className="text-sm leading-relaxed bg-muted/50 rounded-md p-3">
                        {pq.answer || (
                          <span className="italic text-muted-foreground">No answer recorded</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                        Coach's tip
                      </p>
                      <p className="text-sm leading-relaxed">{pq.tip}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                        A stronger answer
                      </p>
                      <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                        <p className="text-sm leading-relaxed">{pq.improved_answer}</p>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
        <Button asChild variant="outline">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
        <Button
          variant="secondary"
          onClick={() => downloadReportPdf(role, feedback)}
        >
          <Download className="h-4 w-4 mr-2" />
          Download PDF report
        </Button>
        <Button asChild className="shadow-premium">
          <Link to="/create">
            <Plus className="h-4 w-4 mr-2" />
            New interview
            <Sparkles className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function SubScore({
  label,
  score,
  grade,
  color,
}: {
  label: string;
  score: number;
  grade: (s: number) => string;
  color: (s: number) => string;
}) {
  return (
    <Card className="p-5 bg-gradient-card border-border/60">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={`text-xs font-medium ${color(score)}`}>{grade(score)}</span>
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-3xl font-bold tracking-tight">{score}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
      <Progress value={score} className="h-2 mt-3" />
    </Card>
  );
}

function FeedbackList({
  title,
  icon: Icon,
  tone,
  items,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "warning";
  items: string[];
}) {
  const toneClasses =
    tone === "success"
      ? "text-success"
      : "text-warning";
  return (
    <Card className="p-6 bg-gradient-card border-border/60 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`h-5 w-5 ${toneClasses}`} />
        <h2 className="font-semibold">{title}</h2>
      </div>
      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
            <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${tone === "success" ? "bg-success" : "bg-warning"}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
