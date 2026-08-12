"use client";

import { useState } from "react";
import type { z } from "zod";
import type { QuizSchema } from "@/lib/schema";

type Quiz = z.infer<typeof QuizSchema>;

export function QuizBlock({ quiz }: { quiz: Quiz }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [graded, setGraded] = useState(false);

  const isCorrect = selected === quiz.answer;

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
            }}
          />
          {opt}
        </label>
      ))}

      <button
        onClick={() => setGraded(true)}
        disabled={selected === null}
        style={{
          marginTop: 8,
          padding: "8px 14px",
          borderRadius: 8,
          border: "1px solid var(--line-strong)",
          background: "transparent",
          color: "var(--ink-dim)",
          fontWeight: 700,
          fontSize: 13,
          cursor: selected === null ? "not-allowed" : "pointer",
          opacity: selected === null ? 0.5 : 1,
        }}
      >
        채점하기
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
    </div>
  );
}
