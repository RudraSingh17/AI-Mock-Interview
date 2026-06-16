import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const MODEL = "google/gemini-2.5-flash";

interface QuestionsBody {
  action: "generate_questions";
  role: string;
  resume: string;
}
interface FeedbackBody {
  action: "generate_feedback";
  role: string;
  resume: string;
  qa: { question: string; answer: string }[];
}

type Body = QuestionsBody | FeedbackBody;

async function callAI(payload: unknown) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (res.status === 429) {
    return { error: "rate_limited", message: "Too many requests, please try again in a moment.", status: 429 };
  }
  if (res.status === 402) {
    return { error: "payment_required", message: "AI usage limit reached. Add credits to continue.", status: 402 };
  }
  if (!res.ok) {
    const t = await res.text();
    console.error("AI gateway error:", res.status, t);
    return { error: "ai_error", message: "AI service error.", status: 500 };
  }
  return { ok: true, data: await res.json() };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;

    if (body.action === "generate_questions") {
      const { role, resume } = body;
      if (!role || !resume) {
        return new Response(JSON.stringify({ error: "Missing role or resume" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await callAI({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an expert technical interviewer. Generate exactly 9 high-quality mock interview questions tailored to the candidate's resume and target role. Mix: 4 technical/role-specific (test depth), 2 behavioral (STAR-style), 2 resume-specific (about projects/experience listed), 1 situational. Questions should be conversational and clear when read aloud. Do NOT include any 'introduce yourself' or 'tell me about yourself' question — that is asked separately. Return ONLY the 9 questions via the tool call.",
          },
          {
            role: "user",
            content: `Target role: ${role}\n\nResume:\n${resume.slice(0, 8000)}\n\nReturn 9 question strings.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_questions",
              description: "Submit the 9 interview questions",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    minItems: 9,
                    maxItems: 9,
                    items: { type: "string" },
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_questions" } },
      });

      if ("error" in result) {
        return new Response(JSON.stringify({ error: result.message }), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const toolCall = result.data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        return new Response(JSON.stringify({ error: "No tool call returned" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const parsed = JSON.parse(toolCall.function.arguments);
      // Always prepend the introduction question as Q1
      const questions = ["Introduce yourself.", ...parsed.questions].slice(0, 10);
      return new Response(JSON.stringify({ questions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "generate_feedback") {
      const { role, resume, qa } = body;
      if (!role || !qa || !Array.isArray(qa) || qa.length === 0) {
        return new Response(JSON.stringify({ error: "Missing data" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const transcript = qa
        .map((p, i) => `Q${i + 1}: ${p.question}\nA${i + 1}: ${p.answer || "(no answer)"}`)
        .join("\n\n");

      const result = await callAI({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a senior interview coach. Analyze the candidate's mock interview and produce honest, structured, actionable feedback.\n\nSCORING RUBRIC (CRITICAL — apply strictly):\nFor each question, give a 0-10 score using this rule:\n- If the candidate's answer is RELEVANT to their resume/background OR is LOGICALLY CORRECT and addresses the question, award FULL MARKS (10/10).\n- If the answer is partially correct or only loosely related, award 5-8 based on quality.\n- If the answer is missing, off-topic, or wrong, award 0-4.\n- Be GENEROUS when the candidate clearly understands the topic, even if phrasing is imperfect.\n\nFor each per-question item include: the score (0-10), a one-line coaching tip, and a model improved answer (1-3 sentences). Reference specifics from what they said. Compute overall_score as the average of per-question scores × 10 (so 10/10 average → 100).",
          },
          {
            role: "user",
            content: `Target role: ${role}\n\nResume excerpt:\n${(resume || "").slice(0, 3000)}\n\nInterview transcript:\n${transcript}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_feedback",
              description: "Submit structured interview feedback",
              parameters: {
                type: "object",
                properties: {
                  overall_score: { type: "integer", minimum: 0, maximum: 100 },
                  summary: { type: "string", description: "2-3 sentence overall assessment." },
                  communication_score: { type: "integer", minimum: 0, maximum: 100 },
                  technical_score: { type: "integer", minimum: 0, maximum: 100 },
                  confidence_score: { type: "integer", minimum: 0, maximum: 100 },
                  strengths: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
                  weaknesses: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
                  improvements: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 3,
                    maxItems: 6,
                    description: "Concrete suggestions to enhance answers, communication, and confidence.",
                  },
                  per_question: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        answer: { type: "string" },
                        score: { type: "integer", minimum: 0, maximum: 10 },
                        tip: { type: "string" },
                        improved_answer: { type: "string" },
                      },
                      required: ["question", "answer", "score", "tip", "improved_answer"],
                      additionalProperties: false,
                    },
                  },
                },
                required: [
                  "overall_score",
                  "summary",
                  "communication_score",
                  "technical_score",
                  "confidence_score",
                  "strengths",
                  "weaknesses",
                  "improvements",
                  "per_question",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_feedback" } },
      });

      if ("error" in result) {
        return new Response(JSON.stringify({ error: result.message }), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const toolCall = result.data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        return new Response(JSON.stringify({ error: "No tool call returned" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const feedback = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ feedback }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("interview-ai error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
