"use client";

import { useState } from "react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false); // 다크패턴 금지 — 기본 미체크
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/notifications/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, marketingConsent }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorMsg(data?.message ?? "신청에 실패했어요.");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setErrorMsg("네트워크 오류로 신청하지 못했어요.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return <p style={{ fontSize: 14 }}>✅ 알림 신청이 완료됐어요.</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="name@example.com"
        style={{
          width: "100%",
          padding: "11px 12px",
          border: "1px solid var(--line-strong)",
          borderRadius: 8,
          fontSize: 14,
          marginBottom: 10,
        }}
      />
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={marketingConsent}
          onChange={(e) => setMarketingConsent(e.target.checked)}
          style={{ width: "auto" }}
        />
        마케팅 정보(이벤트·혜택 안내) 이메일도 받아볼게요 (선택)
      </label>
      {errorMsg && <p className="formError">{errorMsg}</p>}
      <button type="submit" disabled={status === "submitting"} className="btn btnOutline" style={{ marginTop: 10 }}>
        {status === "submitting" ? "신청 중..." : "출시 알림 받기"}
      </button>
    </form>
  );
}
