"use client";

import { useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/client-auth";

type Line = { role: "user" | "bot" | "sys"; text: string };

export function AiTutorPanel({
  exampleLabel,
  stepName,
}: {
  exampleLabel: string;
  stepName: string;
}) {
  const [lines, setLines] = useState<Line[]>([
    { role: "sys", text: "AI 튜터가 준비되었습니다. 이 예제에 대해 무엇이든 물어보세요. (무료 플랜: 하루 10회, 로그인 필요)" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  async function ask(preset?: string) {
    const question = preset ?? input.trim();
    if (!question || busy) return;

    setLines((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setBusy(true);

    try {
      // authedFetch가 만료된 토큰이면 자동으로 갱신 후 재시도한다 (2026-08-13 수정).
      const res = await authedFetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, exampleLabel, stepName }),
      });
      const data = await res.json();

      if (res.status === 401) {
        setNeedsLogin(true);
        setLines((prev) => [...prev, { role: "sys", text: "⚠ 로그인이 필요해요." }]);
      } else if (!res.ok) {
        setLines((prev) => [...prev, { role: "sys", text: `⚠ ${data.message ?? "오류가 발생했어요."}` }]);
      } else {
        setLines((prev) => [...prev, { role: "bot", text: data.answer }]);
        if (typeof data.remaining === "number") setRemaining(data.remaining);
      }
    } catch {
      setLines((prev) => [...prev, { role: "sys", text: "⚠ 연결에 문제가 있어요. 잠시 후 다시 시도해주세요." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3>🤖 AI 튜터</h3>
      <p style={{ fontSize: 12, color: "var(--ink-dim)" }}>
        정답을 바로 알려주지 않고, 단계별 힌트와 원리를 함께 설명해줘요.
        {remaining !== null && <> · 오늘 남은 질문 {remaining}회</>}
      </p>

      {needsLogin && (
        <div style={{ background: "var(--sage-pale)", border: "1px solid var(--line-strong)", borderRadius: 8, padding: 12, marginBottom: 10, textAlign: "center" }}>
          <p style={{ fontSize: 13, margin: "0 0 8px" }}>AI 튜터에게 물어보려면 로그인이 필요해요</p>
          <Link href="/login" className="btn btnCoral" style={{ fontSize: 13, padding: "7px 16px" }}>로그인하러 가기</Link>
        </div>
      )}

      <div
        style={{
          background: "#152420",
          borderRadius: 8,
          padding: 10,
          height: 220,
          overflowY: "auto",
          fontFamily: "monospace",
          fontSize: 12.5,
        }}
      >
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              marginBottom: 8,
              color: l.role === "user" ? "#8fd0e0" : l.role === "sys" ? "#f0b56a" : "#dff0e6",
              whiteSpace: "pre-wrap",
            }}
          >
            <b>{l.role === "user" ? "나> " : l.role === "sys" ? "SYS> " : "AI> "}</b>
            {l.text}
          </div>
        ))}
        {busy && <div style={{ color: "#8fe3b0" }}>AI&gt; …</div>}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="질문을 입력하세요"
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--line-strong)",
            fontSize: 13,
          }}
        />
        <button
          onClick={() => ask()}
          disabled={busy}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "none",
            background: "var(--sage)",
            color: "#fff",
            fontWeight: 700,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          보내기
        </button>
      </div>
      <button
        onClick={() => ask("힌트 하나만 주세요")}
        disabled={busy}
        style={{
          marginTop: 8,
          fontSize: 11,
          background: "none",
          border: "1px dashed var(--line-strong)",
          borderRadius: 6,
          padding: "4px 8px",
          cursor: "pointer",
          color: "var(--ink-dim)",
        }}
      >
        💡 힌트 요청
      </button>
    </div>
  );
}
