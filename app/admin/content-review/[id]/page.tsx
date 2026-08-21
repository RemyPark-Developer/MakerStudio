"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { authedFetch } from "@/lib/client-auth";

// quiz/explain 등 필드가 문자열일 수도, {ko, en} 다국어 객체일 수도 있어 안전하게 텍스트만 뽑아낸다.
function pickText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.ko === "string") return obj.ko;
    if (typeof obj.en === "string") return obj.en;
  }
  return "";
}

type ContentModule = {
  id: string;
  slug: string;
  version: number;
  label_ko: string;
  board: string;
  difficulty: number;
  estimated_minutes: number;
  intro_ko: string;
  parts: string[];
  circuit: any;
  code: string;
  codeHtml: string | null;
  explain_ko: string;
  mission_ko: string;
  quiz: any;
  status: string;
  retry_count: number;
  last_error: string | null;
  is_premium: boolean;
};

type ChatMsg = { id: string; role: "admin" | "assistant"; content: string; created_at: string };

export default function ContentReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [module, setModule] = useState<ContentModule | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  const [actionBusy, setActionBusy] = useState(false);
  const [note, setNote] = useState("");
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  const [reviseBusy, setReviseBusy] = useState(false);
  const [reviseMsg, setReviseMsg] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    authedFetch(`/api/content/${params.id}`)
      .then((res) => {
        if (res.status === 401) { setForbidden(true); return Promise.reject(401); }
        if (res.status === 404) { setNotFound(true); return Promise.reject(404); }
        return res.ok ? res.json() : Promise.reject(res.status);
      })
      .then((data) => {
        setModule(data.module);
        setIsPremium(Boolean(data.module?.is_premium));
      })
      .catch(() => {});

    authedFetch(`/api/content/${params.id}/review-chat`)
      .then((res) => (res.ok ? res.json() : { messages: [] }))
      .then((data) => setChat(data.messages ?? []))
      .catch(() => {});
  }, [params.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  async function sendChat() {
    const question = chatInput.trim();
    if (!question || chatBusy) return;

    setChat((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, role: "admin", content: question, created_at: new Date().toISOString() },
    ]);
    setChatInput("");
    setChatBusy(true);

    try {
      const res = await authedFetch(`/api/content/${params.id}/review-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (res.ok) {
        setChat((prev) => [
          ...prev,
          { id: `temp-a-${Date.now()}`, role: "assistant", content: data.answer, created_at: new Date().toISOString() },
        ]);
      } else {
        setChat((prev) => [
          ...prev,
          { id: `temp-e-${Date.now()}`, role: "assistant", content: `⚠ ${data.message ?? "오류가 발생했어요."}`, created_at: new Date().toISOString() },
        ]);
      }
    } catch {
      setChat((prev) => [
        ...prev,
        { id: `temp-e2-${Date.now()}`, role: "assistant", content: "⚠ 연결에 문제가 있어요.", created_at: new Date().toISOString() },
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  async function handleReview(action: "approve" | "reject") {
    if (action === "reject" && !confirm("정말 반려하시겠어요?")) return;
    if (
      action === "approve" &&
      !confirm(
        `승인하면 즉시 웹사이트에 ${isPremium ? "유료(Premium)" : "무료"} 콘텐츠로 공개됩니다. 진행할까요?`
      )
    )
      return;

    setActionBusy(true);
    setActionMsg(null);
    try {
      const res = await authedFetch(`/api/content/${params.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note.trim() || undefined, isPremium }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg(data.message ?? "처리에 실패했어요.");
        return;
      }
      setActionMsg(action === "approve" ? "승인되어 게시됐어요." : "반려 처리했어요.");
      setTimeout(() => router.push("/admin/content-review"), 1200);
    } catch {
      setActionMsg("네트워크 오류가 발생했어요.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleRevise() {
    if (!confirm(`v${(module?.version ?? 1) + 1} 개선판 초안을 만들까요? 지금 v${module?.version} 내용을 그대로 복제해서 검수 대기 상태로 넣어요.`)) return;

    setReviseBusy(true);
    setReviseMsg(null);
    try {
      const res = await authedFetch(`/api/content/${params.id}/revise`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setReviseMsg(data.message ?? "개선판 생성에 실패했어요.");
        return;
      }
      router.push(`/admin/content-review/${data.id}`);
    } catch {
      setReviseMsg("네트워크 오류가 발생했어요.");
    } finally {
      setReviseBusy(false);
    }
  }

  if (forbidden) {
    return (
      <main className="wrap">
        <div className="card center"><h2>관리자만 접근할 수 있어요</h2></div>
      </main>
    );
  }
  if (notFound) {
    return (
      <main className="wrap">
        <div className="card center"><h2>콘텐츠를 찾을 수 없어요</h2></div>
      </main>
    );
  }
  if (!module) {
    return (
      <main className="wrap">
        <p className="muted">불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="wrap">
      <p><Link href="/admin/content-review">← 목록으로</Link></p>

      <div className="card">
        <div className="tab">기본 정보</div>
        <h2>
          {module.label_ko} <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>v{module.version}</span>
        </h2>
        <p className="muted">
          {module.board} · 난이도 {module.difficulty} · {module.estimated_minutes}분 · 재시도 {module.retry_count}회 · slug: {module.slug}
        </p>
        {module.last_error && (
          <p style={{ color: "#c0392b", fontSize: 13, marginTop: 8 }}>
            마지막 오류: {module.last_error}
          </p>
        )}
        <p style={{ marginTop: 10 }}>{module.intro_ko}</p>
        <p style={{ marginTop: 10, fontSize: 13 }}>
          <b>준비물:</b> {module.parts?.join(", ")}
        </p>
      </div>

      {module.status === "published" && (
        <div className="card">
          <div className="tab">§6.3-a 개선판</div>
          <p className="muted" style={{ fontSize: 13 }}>
            지금 v{module.version} 내용을 그대로 복제해 v{module.version + 1} 초안을 만들어요.
            승인 전까지 기존 v{module.version}은 그대로 서비스되고, 승인하면 신규 학습자는
            새 버전을, 이미 학습 중이던 사용자는 계속 v{module.version}을 봐요(자동 전환 없음).
          </p>
          <button onClick={handleRevise} disabled={reviseBusy} className="btn btnOutline" style={{ marginTop: 8 }}>
            {reviseBusy ? "생성 중..." : `개선판 만들기 (v${module.version + 1} 초안)`}
          </button>
          {reviseMsg && <p className="muted" style={{ marginTop: 10 }}>{reviseMsg}</p>}
        </div>
      )}

      <div className="card">
        <div className="tab">전체 코드</div>
        {module.codeHtml ? (
          <div
            className="codebox-wrap"
            style={{
              background: "#152420",
              color: "#dff0e6",
              padding: 12,
              borderRadius: 8,
              fontSize: 12.5,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
            }}
            dangerouslySetInnerHTML={{ __html: module.codeHtml }}
          />
        ) : (
          <pre
            style={{
              background: "#152420",
              color: "#dff0e6",
              padding: 12,
              borderRadius: 8,
              fontSize: 12.5,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {module.code}
          </pre>
        )}
      </div>

      <div className="card">
        <div className="tab">설명 · 미션 · 퀴즈</div>
        <p><b>설명:</b> {module.explain_ko}</p>
        <p style={{ marginTop: 8 }}><b>미션:</b> {module.mission_ko}</p>
        <p style={{ marginTop: 8 }}>
          <b>퀴즈:</b> {pickText(module.quiz?.question)} (정답: {pickText(module.quiz?.options?.[module.quiz?.answer])})
        </p>
      </div>

      <div className="card">
        <div className="tab">AI에게 검수 질문하기</div>
        <div
          style={{
            background: "#152420",
            borderRadius: 8,
            padding: 10,
            height: 240,
            overflowY: "auto",
            fontSize: 12.5,
          }}
        >
          {chat.length === 0 && (
            <p style={{ color: "#8fe3b0" }}>이 콘텐츠에 대해 궁금한 점을 물어보세요. (예: "핀 배정이 맞나요?")</p>
          )}
          {chat.map((m) => (
            <div
              key={m.id}
              style={{
                marginBottom: 8,
                color: m.role === "admin" ? "#8fd0e0" : "#dff0e6",
                whiteSpace: "pre-wrap",
              }}
            >
              <b>{m.role === "admin" ? "관리자> " : "AI> "}</b>
              {m.content}
            </div>
          ))}
          {chatBusy && <div style={{ color: "#8fe3b0" }}>AI&gt; …</div>}
          <div ref={chatEndRef} />
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            placeholder="예: 핀 배정이 실제로 맞는지 확인해줘"
            style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line-strong)", fontSize: 13 }}
          />
          <button onClick={sendChat} disabled={chatBusy} className="btn btnCoral">
            질문
          </button>
        </div>
      </div>

      <div className="card">
        <div className="tab">검수 결정</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="검수 메모 (선택, 반려 사유 등)"
          style={{ width: "100%", minHeight: 70, padding: 10, borderRadius: 8, border: "1px solid var(--line-strong)", fontSize: 13 }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={isPremium}
            onChange={(e) => setIsPremium(e.target.checked)}
          />
          유료(Premium) 콘텐츠로 설정 — 승인 시 code/설명은 구독자에게만 공개돼요
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={() => handleReview("approve")} disabled={actionBusy} className="btn btnCoral">
            승인 → 게시
          </button>
          <button onClick={() => handleReview("reject")} disabled={actionBusy} className="btn btnOutline">
            반려
          </button>
        </div>
        {actionMsg && <p className="muted" style={{ marginTop: 10 }}>{actionMsg}</p>}
      </div>
    </main>
  );
}