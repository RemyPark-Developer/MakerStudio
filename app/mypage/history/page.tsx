"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/client-auth";

type Msg = { id: string; example_id: string; role: "user" | "assistant"; content: string; created_at: string };
type Me = { role: string; childId: string | null; needsNickname: boolean };

export default function TutorHistoryPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [viewingChild, setViewingChild] = useState(false);
  const [conversations, setConversations] = useState<Record<string, Msg[]> | null>(null);
  const [openExample, setOpenExample] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("ms_access_token")) {
      setNeedsLogin(true);
      return;
    }
    authedFetch("/api/identity/me")
      .then((res) => (res.status === 401 ? Promise.reject(401) : res.json()))
      .then((data: Me) => setMe(data))
      .catch(() => setNeedsLogin(true));
  }, []);

  useEffect(() => {
    if (!me) return;
    loadConversations(viewingChild);
  }, [me, viewingChild]);

  function loadConversations(asChild: boolean) {
    setConversations(null);
    const query = asChild && me?.childId ? `?childId=${me.childId}` : "";
    authedFetch(`/api/learning/tutor-history${query}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => setConversations(data.conversations ?? {}))
      .catch(() => setConversations({}));
  }

  if (needsLogin) {
    return (
      <main className="wrap">
        <div className="card center">
          <h2>로그인이 필요해요</h2>
          <Link href="/login" className="btn btnCoral fullBtn">로그인하러 가기</Link>
        </div>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="wrap">
        <p className="muted">불러오는 중...</p>
      </main>
    );
  }

  const exampleIds = conversations ? Object.keys(conversations) : [];

  return (
    <main className="wrap">
      {me.role === "guardian" && me.childId && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setViewingChild(false)}
            className="btn"
            style={{
              background: !viewingChild ? "var(--sage, #3B8F63)" : "transparent",
              color: !viewingChild ? "#fff" : "var(--ink-dim, #666)",
              border: "1px solid var(--line-strong, #ddd)",
            }}
          >
            내 대화
          </button>
          <button
            onClick={() => setViewingChild(true)}
            className="btn"
            style={{
              background: viewingChild ? "var(--sage, #3B8F63)" : "transparent",
              color: viewingChild ? "#fff" : "var(--ink-dim, #666)",
              border: "1px solid var(--line-strong, #ddd)",
            }}
          >
            자녀 대화
          </button>
        </div>
      )}

      <div className="card">
        <div className="tab">AI 튜터 대화 기록</div>
        <h2>강의별 대화 모아보기</h2>

        {conversations === null ? (
          <p className="muted">불러오는 중...</p>
        ) : exampleIds.length === 0 ? (
          <p className="muted">아직 AI 튜터와 나눈 대화가 없어요.</p>
        ) : (
          exampleIds.map((exampleId) => (
            <div key={exampleId} style={{ borderBottom: "1px solid var(--grid-line)" }}>
              <button
                onClick={() => setOpenExample(openExample === exampleId ? null : exampleId)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 0",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {openExample === exampleId ? "▼" : "▶"} {exampleId}
                <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                  ({conversations![exampleId].length}개 메시지)
                </span>
              </button>

              {openExample === exampleId && (
                <div style={{ padding: "0 0 12px", fontSize: 13 }}>
                  {conversations![exampleId].map((m) => (
                    <div
                      key={m.id}
                      style={{
                        marginBottom: 8,
                        padding: 8,
                        borderRadius: 6,
                        background: m.role === "user" ? "var(--sage-pale, #eef6f0)" : "#f5f5f5",
                      }}
                    >
                      <b>{m.role === "user" ? "질문" : "AI 답변"}</b>
                      <span className="muted" style={{ marginLeft: 8, fontSize: 11 }}>
                        {new Date(m.created_at).toLocaleString("ko-KR")}
                      </span>
                      <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{m.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </main>
  );
}