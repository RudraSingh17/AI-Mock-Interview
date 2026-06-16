import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  loadFaceModels,
  checkFace,
  createLivenessState,
  type LivenessState,
} from "@/lib/face-detection";
import {
  Mic,
  MicOff,
  Loader2,
  ArrowLeft,
  Play,
  Volume2,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/interview/$id")({
  component: () => (
    <AppShell>
      <InterviewSession />
    </AppShell>
  ),
});

interface QA {
  question: string;
  answer: string;
}

// Browser SpeechRecognition typing
type SR = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }> & { isFinal?: boolean }> & { length: number } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SR;
    webkitSpeechRecognition?: new () => SR;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function InterviewSession() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<string[]>([]);
  const [role, setRole] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [interim, setInterim] = useState("");
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [supportsSTT, setSupportsSTT] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceWarning, setFaceWarning] = useState(false);
  const [faceReason, setFaceReason] = useState<string>("");
  const [modelsReady, setModelsReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recogRef = useRef<SR | null>(null);
  const finalAnswerRef = useRef("");
  const faceCheckIntervalRef = useRef<number | null>(null);
  const livenessStateRef = useRef<LivenessState>(createLivenessState());
  const faceWarningRef = useRef(false);
  const recordingBeforePauseRef = useRef(false);

  // Load interview
  useEffect(() => {
    if (!user) return;
    supabase
      .from("interviews")
      .select("role, questions, answers, resume_text, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error("Interview not found");
          navigate({ to: "/dashboard" });
          return;
        }
        if (data.status === "completed") {
          navigate({ to: `/results/${id}` });
          return;
        }
        const qs = data.questions as string[];
        setQuestions(qs);
        setRole(data.role);
        setResumeText(data.resume_text ?? "");
        setAnswers(Array(qs.length).fill(""));
        setLoading(false);
      });
  }, [id, user, navigate]);

  // Detect speech recognition support
  useEffect(() => {
    setSupportsSTT(getSpeechRecognition() !== null);
  }, []);

  // Setup camera
  const startFaceDetection = useCallback(async () => {
    if (faceCheckIntervalRef.current) {
      window.clearInterval(faceCheckIntervalRef.current);
    }
    livenessStateRef.current = createLivenessState();

    try {
      await loadFaceModels();
      setModelsReady(true);
    } catch (err) {
      console.error("Failed to load face models:", err);
      toast.error("Face detection models failed to load. Continuing without liveness checks.");
      return;
    }

    faceCheckIntervalRef.current = window.setInterval(async () => {
      const video = videoRef.current;
      if (!video) return;
      try {
        const result = await checkFace(video, livenessStateRef.current);
        const ok =
          result.faceDetected &&
          !result.multipleFaces &&
          result.bothEyesVisible &&
          result.centered &&
          result.livenessOk;
        const warn = !ok;
        setFaceWarning(warn);
        faceWarningRef.current = warn;
        setFaceReason(result.reason ?? "");

        // Auto-pause speech recognition while face not visible
        if (warn && recogRef.current) {
          recordingBeforePauseRef.current = true;
          const r = recogRef.current as unknown as { _manualStop?: () => void };
          r._manualStop?.();
          recogRef.current = null;
          setRecording(false);
        }
      } catch (err) {
        console.warn("face check failed:", err);
      }
    }, 800);
  }, []);

  const setupCamera = useCallback(async () => {
    setCameraError(null);
    try {
      // Wait for the <video> element to mount
      for (let i = 0; i < 20 && !videoRef.current; i++) {
        await new Promise((r) => setTimeout(r, 50));
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        try {
          await video.play();
        } catch (e) {
          console.warn("video.play() failed:", e);
        }
      }
      setCameraReady(true);
      startFaceDetection();
    } catch (err) {
      console.error(err);
      const e = err as { name?: string };
      if (e?.name === "NotAllowedError") {
        setCameraError("Permission denied. Allow camera & microphone in your browser settings.");
      } else if (e?.name === "NotFoundError") {
        setCameraError("No camera found. Please connect a camera.");
      } else if (e?.name === "NotReadableError") {
        setCameraError("Camera is in use by another app. Close other apps and retry.");
      } else {
        setCameraError("Could not access camera/mic. Please grant permission and retry.");
      }
      toast.error("Could not access camera/mic.");
    }
  }, [startFaceDetection]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      window.speechSynthesis?.cancel();
      recogRef.current?.stop();
      if (faceCheckIntervalRef.current) {
        window.clearInterval(faceCheckIntervalRef.current);
      }
    };
  }, []);

  const speakQuestion = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((v) => /Google US English|Samantha|Microsoft Aria/i.test(v.name));
    if (preferred) utter.voice = preferred;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  }, []);

  const startRecording = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      toast.error("Speech recognition not supported in this browser. Try Chrome or Edge.");
      return;
    }
    const recog = new SR();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = "en-US";
    (recog as unknown as { maxAlternatives?: number }).maxAlternatives = 1;
    finalAnswerRef.current = answers[current] || "";
    setInterim("");
    let lastFinalIndex = 0;
    let manuallyStopped = false;

    recog.onresult = (e) => {
      let interimText = "";
      // Only process results from lastFinalIndex onwards to avoid re-appending finals
      for (let i = lastFinalIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const transcript = res[0].transcript;
        if (res.isFinal) {
          finalAnswerRef.current = (finalAnswerRef.current + " " + transcript).trim();
          lastFinalIndex = i + 1;
        } else {
          interimText += transcript;
        }
      }
      setInterim(interimText);
      setAnswers((prev) => {
        const next = [...prev];
        next[current] = finalAnswerRef.current;
        return next;
      });
    };
    recog.onerror = (e) => {
      console.warn("speech recognition error:", e.error);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        manuallyStopped = true;
        toast.error("Microphone permission denied.");
      }
      // 'no-speech' / 'aborted' / 'network' → let onend auto-restart
    };
    recog.onend = () => {
      if (manuallyStopped) {
        setRecording(false);
        return;
      }
      // Auto-restart: browsers stop the engine after silence, but we want continuous capture
      try {
        lastFinalIndex = 0; // results array resets after restart
        recog.start();
      } catch {
        setRecording(false);
      }
    };

    // Expose stop helper that flags manual stop
    (recog as unknown as { _manualStop: () => void })._manualStop = () => {
      manuallyStopped = true;
      try {
        recog.stop();
      } catch {
        /* ignore */
      }
    };

    try {
      recog.start();
      recogRef.current = recog;
      setRecording(true);
    } catch (err) {
      console.error(err);
    }
  }, [answers, current]);

  const stopRecording = useCallback(() => {
    const recog = recogRef.current as unknown as { _manualStop?: () => void } | null;
    if (recog?._manualStop) {
      recog._manualStop();
    } else {
      recogRef.current?.stop();
    }
    recogRef.current = null;
    setRecording(false);
    setInterim("");
  }, []);

  const handleStart = async () => {
    setStarted(true); // mount the video element first
    await new Promise((r) => setTimeout(r, 50));
    await setupCamera();
    setTimeout(() => speakQuestion(questions[0]), 600);
  };

  const handleNext = useCallback(() => {
    stopRecording();
    if (current < questions.length - 1) {
      const nextIdx = current + 1;
      setCurrent(nextIdx);
      setInterim("");
      setTimeout(() => speakQuestion(questions[nextIdx]), 400);
    }
  }, [current, questions, speakQuestion, stopRecording]);

  const handleFinish = async () => {
    if (!user) return;
    stopRecording();
    window.speechSynthesis?.cancel();
    setSubmitting(true);

    const qa: QA[] = questions.map((q, i) => ({ question: q, answer: answers[i] || "" }));

    try {
      const { data, error } = await supabase.functions.invoke("interview-ai", {
        body: {
          action: "generate_feedback",
          role,
          resume: resumeText,
          qa,
        },
      });
      if (error || !data?.feedback) {
        throw new Error(error?.message || "Failed to generate feedback");
      }

      const { error: updErr } = await supabase
        .from("interviews")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({
          answers: qa as any,
          feedback: data.feedback,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id);
      if (updErr) throw updErr;

      streamRef.current?.getTracks().forEach((t) => t.stop());
      navigate({ to: `/results/${id}` });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to submit");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
      </div>
    );
  }

  if (!started) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <Link to="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Link>
        <Card className="p-8 md:p-10 bg-gradient-card border-border/60 shadow-elegant text-center">
          <div className="inline-flex h-14 w-14 rounded-full bg-gradient-hero items-center justify-center mx-auto mb-4 shadow-glow">
            <Play className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Ready to begin?</h1>
          <p className="text-muted-foreground mt-2">
            Your <span className="font-medium text-foreground">{role}</span> interview has{" "}
            {questions.length} questions. The AI will ask each one aloud — answer naturally with
            your voice, and click <span className="font-medium text-foreground">Next</span> when
            done.
          </p>

          <div className="mt-6 grid sm:grid-cols-3 gap-3 text-left">
            <Tip icon={Volume2} title="Voice on" body="AI speaks each question." />
            <Tip icon={Mic} title="Mic + camera" body="Browser will request access." />
            <Tip icon={CheckCircle2} title="Get feedback" body="Detailed AI report at the end." />
          </div>

          {!supportsSTT && (
            <div className="mt-5 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-left text-sm">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <p>
                Voice recognition isn't supported in this browser. Try{" "}
                <strong>Chrome</strong> or <strong>Edge</strong> for the full experience. You can
                still type answers manually.
              </p>
            </div>
          )}

          <Button size="lg" className="mt-8 shadow-premium" onClick={handleStart}>
            <Play className="h-4 w-4 mr-2" /> Start interview
          </Button>
        </Card>
      </div>
    );
  }

  const isLast = current === questions.length - 1;
  const progress = ((current + 1) / questions.length) * 100;
  const liveText = (answers[current] || "") + (interim ? " " + interim : "");

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{role}</p>
          <h2 className="font-semibold truncate">
            Question {current + 1} of {questions.length}
          </h2>
        </div>
        <div className="flex-1 max-w-xs">
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Video preview */}
        <Card className="overflow-hidden bg-card border-border/60 shadow-elegant">
          <div className="relative aspect-video bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover [transform:scaleX(-1)]"
            />
            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Connecting camera…
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
                <AlertTriangle className="h-8 w-8 text-warning" />
                <p className="text-sm text-white max-w-xs">{cameraError}</p>
                <Button size="sm" variant="secondary" onClick={setupCamera}>
                  Retry
                </Button>
              </div>
            )}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur px-2.5 py-1 text-xs text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" /> LIVE
              </span>
            </div>
            {cameraReady && faceWarning && (
              <div className="absolute top-3 right-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/90 px-2.5 py-1 text-xs text-warning-foreground shadow-md">
                  <AlertTriangle className="h-3 w-3" /> {faceReason || "Face check failed"}
                </span>
              </div>
            )}
            {recording && (
              <div className="absolute bottom-3 left-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/90 px-2.5 py-1 text-xs text-destructive-foreground">
                  <Mic className="h-3 w-3" /> Recording
                </span>
              </div>
            )}
            {cameraReady && !modelsReady && (
              <div className="absolute bottom-3 right-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur px-2.5 py-1 text-xs text-white">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading face AI…
                </span>
              </div>
            )}
            {cameraReady && faceWarning && (
              <div className="absolute inset-x-3 bottom-3 flex justify-center pointer-events-none">
                <div className="bg-warning/95 backdrop-blur rounded-md px-3 py-2 shadow-lg text-center max-w-md">
                  <p className="text-xs sm:text-sm text-warning-foreground font-semibold">
                    ⚠ Please ensure your real face is clearly visible in the camera.
                  </p>
                  {faceReason && (
                    <p className="text-[11px] sm:text-xs text-warning-foreground/90 mt-0.5">
                      {faceReason}. Interview is paused.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* AI interviewer */}
        <Card className="p-6 bg-gradient-card border-border/60 shadow-elegant flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <div
                className={`absolute inset-0 rounded-full bg-gradient-hero blur-md ${speaking ? "pulse-ring" : "opacity-40"}`}
              />
              <div className="relative h-12 w-12 rounded-full bg-gradient-hero flex items-center justify-center text-primary-foreground font-bold">
                AI
              </div>
            </div>
            <div>
              <p className="font-semibold">AI Interviewer</p>
              <p className="text-xs text-muted-foreground">
                {speaking ? "Speaking…" : recording ? "Listening…" : "Ready"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => speakQuestion(questions[current])}
            >
              <Volume2 className="h-4 w-4 mr-1" /> Replay
            </Button>
          </div>

          <div className="rounded-xl bg-background/60 backdrop-blur p-5 border border-border/60">
            <p className="text-base leading-relaxed">{questions[current]}</p>
          </div>

          <div className="mt-5 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Your answer</p>
              {recording ? (
                <Button size="sm" variant="destructive" onClick={stopRecording}>
                  <MicOff className="h-4 w-4 mr-1" /> Stop
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={startRecording}
                  disabled={!supportsSTT || faceWarning}
                  title={faceWarning ? "Face must be visible to record" : undefined}
                >
                  <Mic className="h-4 w-4 mr-1" /> {liveText.trim() ? "Resume" : "Record"}
                </Button>
              )}
            </div>

            <textarea
              value={liveText}
              onChange={(e) => {
                finalAnswerRef.current = e.target.value;
                setAnswers((prev) => {
                  const next = [...prev];
                  next[current] = e.target.value;
                  return next;
                });
                setInterim("");
              }}
              placeholder="Click 'Record' and speak your answer — or type here."
              className="w-full flex-1 min-h-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {(answers[current] || "").trim().split(/\s+/).filter(Boolean).length} words
            </p>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => speakQuestion(questions[current])} disabled={speaking}>
              <Volume2 className="h-4 w-4 mr-1" /> Read again
            </Button>
            {isLast ? (
              <Button onClick={handleFinish} className="shadow-premium" disabled={submitting || faceWarning}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing answers…
                  </>
                ) : (
                  <>
                    Finish interview
                    <CheckCircle2 className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleNext} className="shadow-premium" disabled={faceWarning}>
                Next question
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Tip({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/60 p-3">
      <Icon className="h-4 w-4 text-primary mb-1.5" />
      <p className="font-medium text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{body}</p>
    </div>
  );
}
