import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, Loader2, ArrowLeft, Sparkles, ArrowRight } from "lucide-react";
import { extractPdfText } from "@/lib/pdf";
import { z } from "zod";

export const Route = createFileRoute("/create")({
  component: () => (
    <AppShell>
      <CreateInterview />
    </AppShell>
  ),
});

const schema = z.object({
  role: z.string().trim().min(2, "Enter a target role").max(80),
  resume: z.string().trim().min(50, "Resume seems too short — please upload a complete resume").max(20000),
});

function CreateInterview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [role, setRole] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("PDF too large (max 10MB).");
      return;
    }
    if (!file.type.includes("pdf")) {
      toast.error("Please upload a PDF file.");
      return;
    }
    setParsing(true);
    try {
      const text = await extractPdfText(file);
      if (!text.trim()) {
        toast.error("Couldn't read text from this PDF. Try a text-based PDF.");
        return;
      }
      setResumeText(text);
      setFileName(file.name);
      toast.success("Resume parsed successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to parse PDF.");
    } finally {
      setParsing(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({ role, resume: resumeText });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setCreating(true);
    try {
      // Generate questions via AI
      const { data, error } = await supabase.functions.invoke("interview-ai", {
        body: {
          action: "generate_questions",
          role: parsed.data.role,
          resume: parsed.data.resume,
        },
      });
      if (error || !data?.questions) {
        throw new Error(error?.message || "Failed to generate questions");
      }

      const { data: row, error: insertError } = await supabase
        .from("interviews")
        .insert({
          user_id: user.id,
          role: parsed.data.role,
          resume_text: parsed.data.resume,
          questions: data.questions,
          status: "pending",
        })
        .select("id")
        .single();

      if (insertError || !row) throw new Error(insertError?.message || "Failed to save");

      toast.success("Interview ready!");
      navigate({ to: `/interview/${row.id}` });
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <Link
        to="/dashboard"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to dashboard
      </Link>

      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 backdrop-blur px-4 py-1.5 text-sm text-muted-foreground mb-4">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Step 1 of 2
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Create your interview</h1>
        <p className="text-muted-foreground mt-2">
          Tell us the role and upload your resume — we'll do the rest.
        </p>
      </div>

      <Card className="p-6 md:p-8 bg-gradient-card border-border/60 shadow-elegant">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="role">Target role</Label>
            <Input
              id="role"
              placeholder="e.g. Frontend Developer, Data Analyst, Product Manager"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Upload resume (PDF)</Label>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={parsing}
              className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-accent/30 transition-colors p-8 text-center group"
            >
              {parsing ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Reading your resume…</p>
                </div>
              ) : fileName ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-8 w-8 text-success" />
                  <p className="text-sm font-medium">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {resumeText.length.toLocaleString()} characters · click to replace
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                  <p className="text-sm font-medium">Click to upload your resume</p>
                  <p className="text-xs text-muted-foreground">PDF, up to 10MB</p>
                </div>
              )}
            </button>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Or paste resume text manually
            </summary>
            <Textarea
              className="mt-3 min-h-[160px]"
              placeholder="Paste your resume here…"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
            />
          </details>

          <Button type="submit" size="lg" className="w-full shadow-premium" disabled={creating || parsing}>
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating 10 tailored questions…
              </>
            ) : (
              <>
                Generate questions & start
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
