import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ArrowRight, Brain, Mic, Video, BarChart3, FileText, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="container mx-auto flex h-16 items-center justify-between px-4">
        <Logo />
        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild>
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild>
                <Link to="/auth">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow pointer-events-none" />
        <div className="container mx-auto px-4 pt-20 pb-24 text-center relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 backdrop-blur px-4 py-1.5 text-sm text-muted-foreground mb-8">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Powered by AI — practice like it's real
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl mx-auto leading-[1.05]">
            Ace your next interview with an{" "}
            <span className="text-gradient">AI interviewer</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Upload your resume, sit for a real video & voice mock interview, and get instant
            personalized feedback to land your dream role.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
            <Button size="lg" asChild className="shadow-premium">
              <Link to={user ? "/dashboard" : "/auth"}>
                Start free interview
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#how">How it works</a>
            </Button>
          </div>

          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {[
              { num: "10", label: "Tailored questions" },
              { num: "100%", label: "Voice + video" },
              { num: "<2 min", label: "To get started" },
              { num: "AI", label: "Detailed feedback" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-bold text-gradient">{s.num}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="container mx-auto px-4 py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center">How it works</h2>
        <p className="text-center text-muted-foreground mt-3">
          Three simple steps to interview-ready confidence
        </p>
        <div className="mt-14 grid md:grid-cols-3 gap-6">
          {[
            { icon: FileText, title: "Upload your resume", desc: "Our AI reads your background and the role you're targeting." },
            { icon: Video, title: "Sit for the interview", desc: "An AI interviewer asks 10 tailored questions on camera. You answer by voice." },
            { icon: BarChart3, title: "Get rich feedback", desc: "Receive a score, strengths, weaknesses, and ways to improve every answer." },
          ].map((f, i) => (
            <div
              key={f.title}
              className="relative rounded-2xl bg-gradient-card border border-border p-7 shadow-elegant"
            >
              <div className="absolute -top-3 -left-3 h-9 w-9 rounded-full bg-gradient-hero text-primary-foreground flex items-center justify-center font-semibold shadow-glow">
                {i + 1}
              </div>
              <f.icon className="h-7 w-7 text-primary mb-4" />
              <h3 className="font-semibold text-lg">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-20">
        <div className="rounded-3xl bg-gradient-hero p-1 shadow-premium">
          <div className="rounded-[calc(1.5rem-4px)] bg-card p-10 md:p-16 text-center">
            <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-3xl md:text-4xl font-bold">Ready to practice?</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Your next interview deserves preparation that feels real. Start in under a minute.
            </p>
            <Button size="lg" className="mt-8 shadow-glow" asChild>
              <Link to={user ? "/dashboard" : "/auth"}>
                <Mic className="mr-2 h-4 w-4" />
                Begin your mock interview
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="container mx-auto px-4 py-10 text-center text-sm text-muted-foreground border-t border-border/60">
        © {new Date().getFullYear()} AI Mock Interview · Built for interview-ready confidence
      </footer>
    </div>
  );
}
