"use client";

import { useState } from "react";
import type { z } from "zod";
import type { QuizSchema } from "@/lib/schema";

type Quiz = z.infer<typeof QuizSchema>;

export function QuizBlock({ quiz, exampleId }: { quiz: Quiz; exampleId: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [graded, setGraded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isCorrect = selected === quiz.answer;

  async function handleGrade() {
    if (selected === null) return;
    setGraded(true);
    setSubmitError(null);
    setSubmitting(true);

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("ms_access_token") : null;
      if (!token) {
        setSubmitError("로그인이 필요해요.");
        return;
      }

      const score = isCorrect ? 100 : 0;

      const res = await fetch("/api/learning/quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          moduleId: exampleId,
          score,
          passed: isCorrect,
          answers: { selected },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setSubmitError(body?.message ?? "진도 저장에 실패했어요.");
      }
    } catch {
      setSubmitError("네트워크 오류로 진도가 저장되지 않았어요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h3>{quiz.question}</h3>

      {quiz.options.map((opt, i) => (
        <label
          key={i}
          className="quiz-opt"
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            cursor: "pointer",
            borderColor: selected === i ? "var(--sage)" : undefined,
          }}
        >
          <input
            type="radio"
            name="quiz"
            checked={selected === i}
            onChange={() => {
              setSelected(i);
              setGraded(false);
              setSubmitError(null);
            }}
          />
          {opt}
        </label>
      ))}

      <button
        onClick={handleGrade}
        disabled={selected === null || submitting}
        style={{
          marginTop: 8,
          padding: "8px 14px",
          borderRadius: 8,
          border: "1px solid var(--line-strong)",
          background: "transparent",
          color: "var(--ink-dim)",
          fontWeight: 700,
          fontSize: 13,
          cursor: selected === null || submitting ? "not-allowed" : "pointer",
          opacity: selected === null || submitting ? 0.5 : 1,
        }}
      >
        {submitting ? "채점 중..." : "채점하기"}
      </button>

      {graded && selected !== null && (
        <p
          style={{
            marginTop: 8,
            fontWeight: 700,
            fontSize: 13,
            color: isCorrect ? "var(--ok, #3B8F63)" : "var(--danger, #D1554A)",
          }}
        >
          {isCorrect ? "✅ 정답입니다! " : "❌ 다시 생각해보세요. "}
          {quiz.explain}
        </p>
      )}

      {submitError && (
        <p style={{ marginTop: 6, fontSize: 12, color: "var(--danger, #D1554A)" }}>
          ⚠️ {submitError} (점수는 기록됐을 수 있으니 새로고침 후 마이페이지에서 확인해보세요)
        </p>
      )}
    </div>
  );
}