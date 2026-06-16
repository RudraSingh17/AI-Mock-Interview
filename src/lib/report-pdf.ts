import { jsPDF } from "jspdf";

export interface ReportFeedback {
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

export function downloadReportPdf(role: string, feedback: ReportFeedback) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensure = (need: number) => {
    if (y + need > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text: string, size: number, lineGap = 4, bold = false) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text || "", maxW) as string[];
    for (const ln of lines) {
      ensure(size + lineGap);
      doc.text(ln, margin, y);
      y += size + lineGap;
    }
  };

  // Header
  doc.setFillColor(20, 20, 30);
  doc.rect(0, 0, pageW, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("AI Mock Interview — Report", margin, 50);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Role: ${role}`, margin, 70);
  const dateStr = new Date().toLocaleDateString();
  doc.text(dateStr, pageW - margin - doc.getTextWidth(dateStr), 70);
  doc.setTextColor(0, 0, 0);
  y = 120;

  // Overall score block
  doc.setFontSize(48);
  doc.setFont("helvetica", "bold");
  doc.text(`${feedback.overall_score}`, margin, y + 10);
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("/100  Overall score", margin + 90, y + 10);
  y += 40;

  doc.setFontSize(11);
  doc.text(`Communication: ${feedback.communication_score}/100`, margin, y);
  doc.text(`Technical: ${feedback.technical_score}/100`, margin + 180, y);
  doc.text(`Confidence: ${feedback.confidence_score}/100`, margin + 340, y);
  y += 24;

  // Summary
  writeWrapped("Summary", 14, 6, true);
  writeWrapped(feedback.summary, 11, 4);
  y += 8;

  // Strengths
  writeWrapped("Strengths", 14, 6, true);
  feedback.strengths.forEach((s) => writeWrapped(`• ${s}`, 11, 4));
  y += 8;

  // Weaknesses
  writeWrapped("Areas to improve", 14, 6, true);
  feedback.weaknesses.forEach((s) => writeWrapped(`• ${s}`, 11, 4));
  y += 8;

  // Improvements
  writeWrapped("Suggestions", 14, 6, true);
  feedback.improvements.forEach((s, i) => writeWrapped(`${i + 1}. ${s}`, 11, 4));
  y += 12;

  // Per-question
  writeWrapped("Question-by-question review", 16, 6, true);
  y += 4;

  feedback.per_question.forEach((pq, i) => {
    ensure(80);
    writeWrapped(`Q${i + 1}. ${pq.question}`, 12, 4, true);
    writeWrapped(`Score: ${pq.score}/10`, 11, 4);
    writeWrapped(`Your answer: ${pq.answer || "(no answer)"}`, 11, 4);
    writeWrapped(`Tip: ${pq.tip}`, 11, 4);
    writeWrapped(`Stronger answer: ${pq.improved_answer}`, 11, 4);
    y += 10;
  });

  const safeRole = role.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`ai-mock-interview-${safeRole}-${Date.now()}.pdf`);
}
